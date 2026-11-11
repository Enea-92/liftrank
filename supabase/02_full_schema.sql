-- LiftRank full database schema (Supabase / PostgreSQL).
-- Run order: schema.sql (already run) -> this file -> 03_seed_exercises.sql
-- Safe to re-run: everything is "if not exists" / "create or replace" / drop-and-recreate for policies.
--
-- Security model
--   * Every user-owned table has Row Level Security: users can only touch their own rows.
--   * Child tables carry user_id and use COMPOSITE foreign keys (id, user_id), so a user can never
--     attach their rows to someone else's workout.
--   * Anything that must not be forged (leaderboards, purchases, subscriptions, notifications,
--     friendships) has NO client write policy. It is written only by SECURITY DEFINER functions or
--     by the server (service_role key: payment webhooks, scheduled jobs).
--   * Other users only ever see the safe columns exposed by the public_profiles view.

-- =====================================================================
-- helpers
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- reference data
-- =====================================================================
create table if not exists public.muscle_groups (
  id         text primary key,
  name       text not null,
  region     text not null check (region in ('upper', 'lower', 'core')),
  body_side  text not null check (body_side in ('front', 'back', 'both')),
  sort_order smallint not null
);

insert into public.muscle_groups (id, name, region, body_side, sort_order) values
  ('chest',      'Chest',      'upper', 'front', 1),
  ('back',       'Back',       'upper', 'back',  2),
  ('shoulders',  'Shoulders',  'upper', 'both',  3),
  ('biceps',     'Biceps',     'upper', 'front', 4),
  ('triceps',    'Triceps',    'upper', 'back',  5),
  ('quads',      'Quadriceps', 'lower', 'front', 6),
  ('hamstrings', 'Hamstrings', 'lower', 'back',  7),
  ('glutes',     'Glutes',     'lower', 'back',  8),
  ('calves',     'Calves',     'lower', 'both',  9),
  ('abs',        'Abs',        'core',  'front', 10)
on conflict (id) do nothing;

-- =====================================================================
-- users / profiles
-- (auth.users is the "Users" entity, managed by Supabase Auth)
-- =====================================================================
create table if not exists public.user_profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  username             text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name         text check (char_length(display_name) <= 60),
  avatar_url           text,
  dob                  date check (dob is null or dob > date '1900-01-01'),
  gender               text check (gender in ('male', 'female', 'other', 'prefer_not')),
  height_cm            numeric(5, 1) check (height_cm between 80 and 260),
  bodyweight_kg        numeric(5, 1) check (bodyweight_kg between 20 and 400),
  country              text check (country ~ '^[A-Z]{2}$'),
  experience           text check (experience in ('beginner', 'intermediate', 'advanced')),
  goal                 text check (goal in ('build_muscle', 'increase_strength', 'lose_fat', 'improve_fitness', 'general_health')),
  sessions_per_week    smallint check (sessions_per_week between 1 and 14),
  training_days        smallint[] not null default '{}' check (training_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  workout_duration_min smallint check (workout_duration_min between 10 and 300),
  equipment            text[] not null default '{}',
  preferred_exercise_ids text[] not null default '{}',
  weight_unit          text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  standards_sex        text not null default 'male' check (standards_sex in ('male', 'female')),
  is_public            boolean not null default true,
  onboarded_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists user_profiles_username_lower_idx on public.user_profiles (lower(username));
create index if not exists user_profiles_country_idx on public.user_profiles (country);
drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.notification_preferences (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  workout_reminders  boolean not null default true,
  personal_records   boolean not null default true,
  friend_requests    boolean not null default true,
  friend_rank_ups    boolean not null default true,
  weekly_summary     boolean not null default true,
  program_reminders  boolean not null default true,
  leaderboard_moves  boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- Create the profile rows automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users that signed up before this schema existed.
insert into public.user_profiles (user_id) select id from auth.users on conflict do nothing;
insert into public.notification_preferences (user_id) select id from auth.users on conflict do nothing;

-- =====================================================================
-- exercises (built-in catalog has owner_id null; custom ones belong to a user)
-- =====================================================================
create table if not exists public.exercises (
  id                text primary key,
  owner_id          uuid references auth.users (id) on delete cascade,
  name              text not null check (char_length(name) between 2 and 80),
  primary_muscle    text not null references public.muscle_groups (id),
  secondary_muscles text[] not null default '{}',
  equipment         text not null check (equipment in ('Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Other')),
  category          text not null default 'Push' check (category in ('Push', 'Pull', 'Legs', 'Core', 'Cardio')),
  difficulty        text not null default 'Beginner' check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  tracking_type     text not null default 'weighted' check (tracking_type in ('weighted', 'bodyweight', 'assisted', 'timed', 'cardio')),
  instructions      text not null default '',
  is_ranked         boolean not null default false,
  created_at        timestamptz not null default now(),
  -- custom exercises use ids starting with "custom-" so a user can never take over a built-in id
  check ((owner_id is null and id not like 'custom-%') or (owner_id is not null and id like 'custom-%')),
  check (owner_id is null or is_ranked = false)
);
create unique index if not exists exercises_owner_name_uniq
  on public.exercises (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index if not exists exercises_primary_muscle_idx on public.exercises (primary_muscle);
create index if not exists exercises_owner_idx on public.exercises (owner_id);

-- =====================================================================
-- creators, programs and marketplace
-- =====================================================================
create table if not exists public.creator_profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null check (char_length(display_name) between 2 and 60),
  bio               text check (char_length(bio) <= 1000),
  avatar_url        text,
  payout_account_id text, -- e.g. Stripe Connect account id; only the server writes/reads this
  created_at        timestamptz not null default now()
);

create table if not exists public.training_programs (
  id           uuid primary key default gen_random_uuid(),
  -- null only after the creator deleted their account while customers still own the program
  owner_id     uuid references auth.users (id) on delete set null,
  title        text not null check (char_length(title) between 2 and 100),
  description  text check (char_length(description) <= 5000),
  split_type   text not null default 'custom' check (split_type in ('push_pull_legs', 'upper_lower', 'arnold', 'bro', 'full_body', 'custom')),
  goal         text check (goal in ('build_muscle', 'increase_strength', 'lose_fat', 'improve_fitness', 'general_health')),
  experience   text check (experience in ('beginner', 'intermediate', 'advanced')),
  days_per_week smallint check (days_per_week between 1 and 7),
  cover_url    text,
  is_published boolean not null default false,
  price_cents  integer not null default 0 check (price_cents >= 0 and price_cents <= 100000),
  currency     char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists training_programs_owner_idx on public.training_programs (owner_id);
create index if not exists training_programs_market_idx on public.training_programs (is_published, goal, experience);
drop trigger if exists training_programs_updated_at on public.training_programs;
create trigger training_programs_updated_at before update on public.training_programs
  for each row execute function public.set_updated_at();

create table if not exists public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.training_programs (id) on delete cascade,
  day_index   smallint not null check (day_index between 1 and 14),
  name        text not null check (char_length(name) between 1 and 60),
  weekday     smallint check (weekday between 0 and 6),
  unique (program_id, day_index)
);

create table if not exists public.program_exercises (
  id              uuid primary key default gen_random_uuid(),
  program_day_id  uuid not null references public.program_days (id) on delete cascade,
  exercise_id     text not null references public.exercises (id),
  position        smallint not null check (position >= 1),
  target_sets     smallint not null default 3 check (target_sets between 1 and 20),
  target_reps_min smallint not null default 8 check (target_reps_min between 1 and 100),
  target_reps_max smallint not null default 12 check (target_reps_max between 1 and 100),
  rest_seconds    smallint check (rest_seconds between 0 and 1800),
  notes           text check (char_length(notes) <= 500),
  unique (program_day_id, position),
  check (target_reps_min <= target_reps_max)
);

-- =====================================================================
-- workouts
-- The id is generated on the device. A workout that was uploaded twice (poor connection, retry)
-- is the same row, so offline sync can never create duplicates.
-- =====================================================================
create table if not exists public.workouts (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null default 'Workout' check (char_length(name) <= 100),
  notes            text check (char_length(notes) <= 2000),
  started_at       timestamptz not null,
  finished_at      timestamptz,
  duration_seconds integer check (duration_seconds between 0 and 86400),
  program_day_id   uuid references public.program_days (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  check (finished_at is null or finished_at >= started_at)
);
create index if not exists workouts_user_started_idx on public.workouts (user_id, started_at desc);
drop trigger if exists workouts_updated_at on public.workouts;
create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

create table if not exists public.workout_exercises (
  id          uuid primary key,
  workout_id  uuid not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  position    smallint not null check (position >= 1),
  notes       text check (char_length(notes) <= 1000),
  unique (id, user_id),
  unique (workout_id, position),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);
create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index if not exists workout_exercises_user_exercise_idx on public.workout_exercises (user_id, exercise_id);

create table if not exists public.workout_sets (
  id                  uuid primary key,
  workout_exercise_id uuid not null,
  user_id             uuid not null references auth.users (id) on delete cascade,
  set_number          smallint not null check (set_number >= 1),
  weight_kg           numeric(7, 2) not null default 0 check (weight_kg >= 0 and weight_kg <= 1500),
  reps                integer not null default 0 check (reps between 0 and 10000),
  duration_seconds    integer check (duration_seconds between 0 and 86400),
  distance_m          numeric(10, 1) check (distance_m >= 0),
  rest_seconds        smallint check (rest_seconds between 0 and 3600),
  is_warmup           boolean not null default false,
  completed           boolean not null default false,
  -- Epley estimated one-rep max, computed by the database so it is always consistent
  est_1rm_kg          numeric(8, 2) generated always as (
    case when weight_kg > 0 and reps > 0 then round(weight_kg * (1 + reps / 30.0), 2) end
  ) stored,
  unique (workout_exercise_id, set_number),
  foreign key (workout_exercise_id, user_id) references public.workout_exercises (id, user_id) on delete cascade
);
create index if not exists workout_sets_we_idx on public.workout_sets (workout_exercise_id);
create index if not exists workout_sets_user_idx on public.workout_sets (user_id);

-- =====================================================================
-- records, metrics, rankings
-- =====================================================================
create table if not exists public.personal_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  exercise_id    text not null references public.exercises (id),
  record_type    text not null check (record_type in ('max_weight', 'max_reps_at_weight', 'est_1rm', 'max_volume', 'best_set')),
  value          numeric(10, 2) not null,
  previous_value numeric(10, 2),
  weight_kg      numeric(7, 2),
  reps           integer,
  workout_id     uuid,
  achieved_at    timestamptz not null default now(),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade,
  unique (user_id, exercise_id, record_type, workout_id)
);
create index if not exists personal_records_lookup_idx
  on public.personal_records (user_id, exercise_id, record_type, achieved_at desc);

create table if not exists public.strength_metrics (
  user_id         uuid not null references auth.users (id) on delete cascade,
  exercise_id     text not null references public.exercises (id),
  day             date not null,
  best_est_1rm_kg numeric(8, 2),
  top_weight_kg   numeric(7, 2),
  total_volume_kg numeric(12, 2) not null default 0,
  total_sets      integer not null default 0,
  total_reps      integer not null default 0,
  primary key (user_id, exercise_id, day)
);

create table if not exists public.muscle_rankings (
  user_id              uuid not null references auth.users (id) on delete cascade,
  muscle_id            text not null references public.muscle_groups (id),
  rank_level           smallint not null check (rank_level between 1 and 11),
  score                numeric(8, 3) not null default 0,
  progress_to_next     numeric(4, 3) not null default 0 check (progress_to_next between 0 and 1),
  strongest_exercise_id text references public.exercises (id),
  est_strength_kg      numeric(8, 2),
  updated_at           timestamptz not null default now(),
  primary key (user_id, muscle_id)
);

create table if not exists public.overall_rankings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  rank_level        smallint not null check (rank_level between 1 and 11),
  score             numeric(8, 3) not null default 0,
  consistency_score numeric(5, 3) check (consistency_score between 0 and 1),
  balance_score     numeric(5, 3) check (balance_score between 0 and 1),
  updated_at        timestamptz not null default now()
);

-- Leaderboard scores are computed on the server from stored workout data. Clients cannot write them.
create table if not exists public.leaderboards (
  user_id    uuid not null references auth.users (id) on delete cascade,
  category   text not null check (category in ('overall_strength', 'total_volume', 'consistency') or category ~ '^muscle:[a-z]+$'),
  score      numeric(14, 3) not null,
  rank_level smallint check (rank_level between 1 and 11),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
create index if not exists leaderboards_category_score_idx on public.leaderboards (category, score desc);

create table if not exists public.achievements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  achievement_key text not null check (char_length(achievement_key) between 1 and 100),
  title           text not null check (char_length(title) <= 100),
  description     text check (char_length(description) <= 300),
  data            jsonb not null default '{}'::jsonb,
  achieved_at     timestamptz not null default now(),
  unique (user_id, achievement_key)
);

-- =====================================================================
-- social
-- =====================================================================
create table if not exists public.friends (
  user_id    uuid not null references auth.users (id) on delete cascade,
  friend_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friends_friend_idx on public.friends (friend_id);

create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  from_user    uuid not null references auth.users (id) on delete cascade,
  to_user      uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);
-- only one open request between two people, whichever direction it was sent
create unique index if not exists friend_requests_one_pending_idx
  on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user)) where status = 'pending';
create index if not exists friend_requests_to_idx on public.friend_requests (to_user, status);
create index if not exists friend_requests_from_idx on public.friend_requests (from_user, status);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in ('workout_reminder', 'personal_record', 'friend_request', 'friend_accepted',
                                           'friend_rank_up', 'weekly_summary', 'program_reminder', 'leaderboard_move', 'system')),
  title      text not null check (char_length(title) <= 120),
  body       text check (char_length(body) <= 500),
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- =====================================================================
-- money (written only by the server / payment webhooks)
-- =====================================================================
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  tier                     text not null check (tier in ('free', 'pro')),
  status                   text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  provider                 text not null,
  provider_subscription_id text not null,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

create table if not exists public.purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  program_id          uuid not null references public.training_programs (id) on delete restrict,
  amount_cents        integer not null check (amount_cents >= 0),
  currency            char(3) not null check (currency ~ '^[A-Z]{3}$'),
  provider            text not null,
  provider_payment_id text not null,
  status              text not null check (status in ('pending', 'paid', 'refunded', 'failed')),
  created_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create unique index if not exists purchases_one_paid_per_program on public.purchases (user_id, program_id) where status = 'paid';
create index if not exists purchases_user_idx on public.purchases (user_id);

create table if not exists public.program_reviews (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  unique (program_id, user_id)
);

-- =====================================================================
-- helper functions used by policies (SECURITY DEFINER = they can see rows the caller cannot)
-- =====================================================================
create or replace function public.is_public_user(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_public from public.user_profiles where user_id = uid), false)
$$;

create or replace function public.is_friend(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friends where user_id = auth.uid() and friend_id = uid)
$$;

create or replace function public.has_purchased(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.purchases where user_id = auth.uid() and program_id = pid and status = 'paid')
$$;

-- Program contents are visible to: the owner, anyone for a published FREE program, or buyers of a paid one.
create or replace function public.can_view_program(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.training_programs p
    where p.id = pid
      and (p.owner_id = auth.uid()
           or (p.is_published and p.price_cents = 0)
           or public.has_purchased(p.id))
  )
$$;

create or replace function public.is_program_owner(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.training_programs where id = pid and owner_id = auth.uid())
$$;

create or replace function public.check_username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.user_profiles where lower(username) = lower(p_username) and user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid))
$$;

-- Delete the signed-in user's account and data. Programs nobody bought are deleted with the account;
-- programs that customers paid for are kept for those customers (unpublished, without an owner),
-- so purchase records are never orphaned.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.training_programs p
   where p.owner_id = auth.uid()
     and not exists (select 1 from public.purchases x where x.program_id = p.id);
  update public.training_programs set is_published = false where owner_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- =====================================================================
-- friend functions (the only way friendships and requests are written)
-- =====================================================================
create or replace function public.send_friend_request(p_to uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  rid uuid;
  my_name text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_to = me then raise exception 'you cannot send a friend request to yourself'; end if;
  if not exists (select 1 from auth.users where id = p_to) then raise exception 'user not found'; end if;
  if exists (select 1 from public.friends where user_id = me and friend_id = p_to) then
    raise exception 'you are already friends';
  end if;

  -- they already asked me: just accept theirs
  select id into rid from public.friend_requests
   where from_user = p_to and to_user = me and status = 'pending';
  if rid is not null then
    perform public.respond_friend_request(rid, true);
    return rid;
  end if;

  insert into public.friend_requests (from_user, to_user) values (me, p_to) returning id into rid;

  select coalesce(display_name, username, 'Someone') into my_name from public.user_profiles where user_id = me;
  insert into public.notifications (user_id, type, title, body, data)
  values (p_to, 'friend_request', 'New friend request', my_name || ' wants to be your friend.', jsonb_build_object('request_id', rid, 'from_user', me));
  return rid;
end;
$$;

create or replace function public.respond_friend_request(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  req public.friend_requests;
  my_name text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into req from public.friend_requests where id = p_request for update;
  if not found or req.to_user <> me or req.status <> 'pending' then
    raise exception 'request not found or already answered';
  end if;

  update public.friend_requests
     set status = case when p_accept then 'accepted' else 'rejected' end, responded_at = now()
   where id = p_request;

  if p_accept then
    insert into public.friends (user_id, friend_id) values (req.from_user, req.to_user), (req.to_user, req.from_user)
    on conflict do nothing;
    select coalesce(display_name, username, 'Someone') into my_name from public.user_profiles where user_id = me;
    insert into public.notifications (user_id, type, title, body, data)
    values (req.from_user, 'friend_accepted', 'Friend request accepted', my_name || ' accepted your request.', jsonb_build_object('user_id', me));
  end if;
end;
$$;

create or replace function public.cancel_friend_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.friend_requests set status = 'cancelled', responded_at = now()
   where id = p_request and from_user = auth.uid() and status = 'pending';
  if not found then raise exception 'request not found or already answered'; end if;
end;
$$;

create or replace function public.remove_friend(p_friend uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.friends
   where (user_id = auth.uid() and friend_id = p_friend) or (user_id = p_friend and friend_id = auth.uid());
end;
$$;

-- =====================================================================
-- safe view of other people's profiles (no date of birth, height, weight, goals ...)
-- =====================================================================
create or replace view public.public_profiles as
select p.user_id, p.username, p.display_name, p.avatar_url, p.country
from public.user_profiles p
where p.user_id = auth.uid()
   or p.is_public
   or exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = p.user_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'muscle_groups', 'user_profiles', 'notification_preferences', 'exercises', 'creator_profiles',
    'training_programs', 'program_days', 'program_exercises', 'workouts', 'workout_exercises', 'workout_sets',
    'personal_records', 'strength_metrics', 'muscle_rankings', 'overall_rankings', 'leaderboards',
    'achievements', 'friends', 'friend_requests', 'notifications', 'subscriptions', 'purchases', 'program_reviews'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Tables where a user fully owns their rows (select / insert / update / delete own).
do $$
declare t text;
begin
  foreach t in array array[
    'user_profiles', 'notification_preferences', 'workouts', 'workout_exercises', 'workout_sets',
    'personal_records', 'strength_metrics', 'muscle_rankings', 'overall_rankings'
  ] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- muscle groups: everyone can read, nobody can write from the app
drop policy if exists "read muscle groups" on public.muscle_groups;
create policy "read muscle groups" on public.muscle_groups for select to authenticated, anon using (true);

-- exercises: built-ins + your own customs
drop policy if exists "read exercises" on public.exercises;
drop policy if exists "insert own exercises" on public.exercises;
drop policy if exists "update own exercises" on public.exercises;
drop policy if exists "delete own exercises" on public.exercises;
create policy "read exercises" on public.exercises for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy "insert own exercises" on public.exercises for insert to authenticated with check (owner_id = auth.uid());
create policy "update own exercises" on public.exercises for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own exercises" on public.exercises for delete to authenticated using (owner_id = auth.uid());

-- creators: public to read, own to write (payout_account_id is hidden from readers below)
drop policy if exists "read creators" on public.creator_profiles;
drop policy if exists "write own creator" on public.creator_profiles;
create policy "read creators" on public.creator_profiles for select to authenticated using (true);
create policy "write own creator" on public.creator_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke select on public.creator_profiles from authenticated;
grant select (user_id, display_name, bio, avatar_url, created_at) on public.creator_profiles to authenticated;

-- programs: owner sees everything, everyone sees published listings; only creators can publish
drop policy if exists "read programs" on public.training_programs;
drop policy if exists "insert own programs" on public.training_programs;
drop policy if exists "update own programs" on public.training_programs;
drop policy if exists "delete own programs" on public.training_programs;
create policy "read programs" on public.training_programs for select to authenticated
  using (owner_id = auth.uid() or is_published);
create policy "insert own programs" on public.training_programs for insert to authenticated
  with check (owner_id = auth.uid()
              and (is_published = false or exists (select 1 from public.creator_profiles c where c.user_id = auth.uid()))
              and (price_cents = 0 or exists (select 1 from public.creator_profiles c where c.user_id = auth.uid())));
create policy "update own programs" on public.training_programs for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
              and (is_published = false or exists (select 1 from public.creator_profiles c where c.user_id = auth.uid()))
              and (price_cents = 0 or exists (select 1 from public.creator_profiles c where c.user_id = auth.uid())));
create policy "delete own programs" on public.training_programs for delete to authenticated using (owner_id = auth.uid());

-- program contents: only for owner / free published / purchased
drop policy if exists "read program days" on public.program_days;
drop policy if exists "write program days" on public.program_days;
create policy "read program days" on public.program_days for select to authenticated using (public.can_view_program(program_id));
create policy "write program days" on public.program_days for all to authenticated
  using (public.is_program_owner(program_id)) with check (public.is_program_owner(program_id));

drop policy if exists "read program exercises" on public.program_exercises;
drop policy if exists "write program exercises" on public.program_exercises;
create policy "read program exercises" on public.program_exercises for select to authenticated
  using (exists (select 1 from public.program_days d where d.id = program_day_id and public.can_view_program(d.program_id)));
create policy "write program exercises" on public.program_exercises for all to authenticated
  using (exists (select 1 from public.program_days d where d.id = program_day_id and public.is_program_owner(d.program_id)))
  with check (exists (select 1 from public.program_days d where d.id = program_day_id and public.is_program_owner(d.program_id)));

-- leaderboards: read yourself and public users; NO write policy (server only)
drop policy if exists "read leaderboards" on public.leaderboards;
create policy "read leaderboards" on public.leaderboards for select to authenticated
  using (user_id = auth.uid() or public.is_public_user(user_id) or public.is_friend(user_id));

-- achievements: yours, plus those of public users / friends; you can add your own
drop policy if exists "read achievements" on public.achievements;
drop policy if exists "insert own achievements" on public.achievements;
create policy "read achievements" on public.achievements for select to authenticated
  using (user_id = auth.uid() or public.is_public_user(user_id) or public.is_friend(user_id));
create policy "insert own achievements" on public.achievements for insert to authenticated with check (user_id = auth.uid());

-- friends / requests: read your own; every change goes through the functions above
drop policy if exists "read own friends" on public.friends;
create policy "read own friends" on public.friends for select to authenticated using (user_id = auth.uid());
drop policy if exists "read own requests" on public.friend_requests;
create policy "read own requests" on public.friend_requests for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- notifications: read / mark read / delete your own; created by the server or the functions above
drop policy if exists "read own notifications" on public.notifications;
drop policy if exists "update own notifications" on public.notifications;
drop policy if exists "delete own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "update own notifications" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- money: read your own, never write from the app
drop policy if exists "read own subscriptions" on public.subscriptions;
create policy "read own subscriptions" on public.subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "read own purchases" on public.purchases;
create policy "read own purchases" on public.purchases for select to authenticated using (user_id = auth.uid());

-- reviews: readable for published programs; only buyers (or the program's free users) can write their own
drop policy if exists "read reviews" on public.program_reviews;
drop policy if exists "write own review" on public.program_reviews;
create policy "read reviews" on public.program_reviews for select to authenticated
  using (exists (select 1 from public.training_programs p where p.id = program_id and (p.is_published or p.owner_id = auth.uid())));
create policy "write own review" on public.program_reviews for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_purchased(program_id));

-- =====================================================================
-- privileges
-- =====================================================================
revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- money and leaderboards are read-only for the app
revoke insert, update, delete on public.subscriptions, public.purchases, public.leaderboards, public.friends, public.friend_requests
  from authenticated, anon;
revoke insert, update, delete on public.muscle_groups from authenticated, anon;

do $$
declare f text;
begin
  foreach f in array array[
    'send_friend_request(uuid)', 'respond_friend_request(uuid, boolean)', 'cancel_friend_request(uuid)',
    'remove_friend(uuid)', 'check_username_available(text)', 'is_public_user(uuid)', 'is_friend(uuid)',
    'has_purchased(uuid)', 'can_view_program(uuid)', 'is_program_owner(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
