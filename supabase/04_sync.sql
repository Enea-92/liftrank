-- LiftRank sync functions (run after 02_full_schema.sql and 03_seed_exercises.sql).
-- The app pushes each finished workout with ONE call (atomic, idempotent: sending it twice does nothing),
-- deletes through a tombstone so deletions reach your other devices, and pulls everything in one call.
-- All functions run as the signed-in user, so row-level security still applies.

create table if not exists public.deleted_workouts (
  user_id    uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);
alter table public.deleted_workouts enable row level security;
drop policy if exists "read own tombstones" on public.deleted_workouts;
create policy "read own tombstones" on public.deleted_workouts for select to authenticated using (user_id = auth.uid());
-- no insert/update/delete policies: tombstones are written only by sync_delete_workout below
revoke insert, update, delete on public.deleted_workouts from anon, authenticated;

create or replace function public.sync_push_exercise(p jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.exercises
    (id, owner_id, name, primary_muscle, secondary_muscles, equipment, category, difficulty, tracking_type, instructions, is_ranked)
  values (
    p->>'id', uid, left(p->>'name', 80), lower(p->>'muscle'),
    coalesce(array(select lower(jsonb_array_elements_text(coalesce(p->'secondary', '[]'::jsonb)))), '{}'::text[]),
    coalesce(nullif(p->>'equipment', ''), 'Other'),
    coalesce(nullif(p->>'category', ''), 'Push'),
    coalesce(nullif(p->>'difficulty', ''), 'Beginner'),
    coalesce(nullif(p->>'tracking', ''), 'weighted'),
    coalesce(p->>'instructions', ''), false
  )
  on conflict (id) do nothing;
end;
$$;

create or replace function public.sync_push_workout(p jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  wid uuid := (p->>'id')::uuid;
  started timestamptz := to_timestamp((p->>'startedAt')::double precision / 1000.0);
  finished timestamptz := case when p->>'finishedAt' is null then null
                               else to_timestamp((p->>'finishedAt')::double precision / 1000.0) end;
  n integer;
  we jsonb; st jsonb;
  we_pos integer; st_pos integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  -- already deleted on another device: do not resurrect it
  if exists (select 1 from public.deleted_workouts where user_id = uid and workout_id = wid) then return; end if;

  -- Finished workouts never change, so an existing row means this one is already stored.
  -- If the id belongs to someone else the insert is rejected by row-level security.
  insert into public.workouts (id, user_id, name, notes, started_at, finished_at, duration_seconds)
  values (
    wid, uid, left(coalesce(nullif(p->>'name', ''), 'Workout'), 100), nullif(left(p->>'notes', 2000), ''),
    started, greatest(finished, started),
    case when finished is null then null
         else least(86400, greatest(0, extract(epoch from (finished - started))::integer)) end
  )
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return; end if;

  we_pos := 0;
  for we in select value from jsonb_array_elements(coalesce(p->'exercises', '[]'::jsonb)) loop
    we_pos := we_pos + 1;
    insert into public.workout_exercises (id, workout_id, user_id, exercise_id, position, notes)
    values ((we->>'id')::uuid, wid, uid, we->>'exerciseId', we_pos, nullif(left(we->>'notes', 1000), ''));

    st_pos := 0;
    for st in select value from jsonb_array_elements(coalesce(we->'sets', '[]'::jsonb)) loop
      st_pos := st_pos + 1;
      insert into public.workout_sets (id, workout_exercise_id, user_id, set_number, weight_kg, reps, completed)
      values (
        (st->>'id')::uuid, (we->>'id')::uuid, uid, st_pos,
        least(1500, greatest(0, coalesce((st->>'weightKg')::numeric, 0))),
        least(10000, greatest(0, coalesce((st->>'reps')::numeric, 0)::integer)),
        coalesce((st->>'done')::boolean, false)
      );
    end loop;
  end loop;
end;
$$;

create or replace function public.sync_delete_workout(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.workouts where id = p_id and user_id = uid;
  insert into public.deleted_workouts (user_id, workout_id) values (uid, p_id) on conflict do nothing;
end;
$$;

create or replace function public.sync_pull()
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  return jsonb_build_object(
    'workouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'notes', w.notes,
        'startedAt', (extract(epoch from w.started_at) * 1000)::bigint,
        'finishedAt', case when w.finished_at is null then null else (extract(epoch from w.finished_at) * 1000)::bigint end,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', we.id,
            'exerciseId', we.exercise_id,
            'notes', we.notes,
            'sets', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', s.id, 'weightKg', s.weight_kg::float8, 'reps', s.reps, 'done', s.completed
              ) order by s.set_number)
              from public.workout_sets s where s.workout_exercise_id = we.id and s.user_id = uid
            ), '[]'::jsonb)
          ) order by we.position)
          from public.workout_exercises we where we.workout_id = w.id and we.user_id = uid
        ), '[]'::jsonb)
      ) order by w.started_at desc)
      from public.workouts w where w.user_id = uid
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'muscle', e.primary_muscle, 'secondary', to_jsonb(e.secondary_muscles),
        'equipment', e.equipment, 'category', e.category, 'difficulty', e.difficulty,
        'tracking', e.tracking_type, 'instructions', e.instructions
      ))
      from public.exercises e where e.owner_id = uid
    ), '[]'::jsonb),
    'deleted', coalesce((select jsonb_agg(d.workout_id) from public.deleted_workouts d where d.user_id = uid), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.sync_push_exercise(jsonb), public.sync_push_workout(jsonb),
  public.sync_delete_workout(uuid), public.sync_pull() from public, anon;
grant execute on function public.sync_push_exercise(jsonb), public.sync_push_workout(jsonb),
  public.sync_delete_workout(uuid), public.sync_pull() to authenticated;
