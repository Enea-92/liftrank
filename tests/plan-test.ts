import { toUuid, uuid, uuidifyWorkout, UUID_RE } from '../src/lib/uuid';
import { planSync, mergeData, CloudData, Pull } from '../src/lib/merge';
let fail = 0; const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('FAIL', m); } };
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// --- uuid
const ids = new Set<string>(); for (let i = 0; i < 5000; i++) ids.add(uuid());
ok(ids.size === 5000 && [...ids].every((x) => V4.test(x)), 'random uuids unique + v4');
ok(toUuid('abc123xyz') === toUuid('abc123xyz'), 'deterministic');
ok(V4.test(toUuid('abc123xyz')), 'derived is valid v4');
ok(toUuid('abc') !== toUuid('abd') && toUuid('') !== toUuid(' '), 'distinct inputs differ');
const u = uuid(); ok(toUuid(u) === u && toUuid(u.toUpperCase()) === u, 'valid uuid passes through');
const many = new Set<string>(); for (let i = 0; i < 20000; i++) many.add(toUuid(Math.random().toString(36).slice(2, 10) + i));
ok(many.size === 20000, 'no collisions over 20k legacy-style ids');

const prof: any = { name: 'x', unit: 'kg' };
const mk = (id: string, t = 1700000000000, sets = 2): any => ({
  id, name: 'W', startedAt: t, finishedAt: t + 1000,
  exercises: [{ id: id + 'e', exerciseId: 'squat', sets: Array.from({ length: sets }, (_, i) => ({ id: `${id}s${i}`, weightKg: 100, reps: 5, done: true })) }],
});
const old = mk('oldid1');
const up = uuidifyWorkout(old);
ok(UUID_RE.test(up.id) && up.exercises.every((e) => UUID_RE.test(e.id) && e.sets.every((s) => UUID_RE.test(s.id))), 'uuidify converts all levels');
ok(uuidifyWorkout(up) === up, 'uuidify idempotent (same object)');
ok(up.exercises[0].sets.length === 2 && up.exercises[0].exerciseId === 'squat', 'structure kept');
ok(JSON.stringify(uuidifyWorkout(mk('oldid1'))) === JSON.stringify(up), 'same legacy id -> same uuid on every device');

// --- planSync
const W = (n: number) => uuidifyWorkout(mk('w' + n, 1700000000000 + n * 86400000));
const cd = (o: Partial<CloudData> = {}): CloudData => ({ profile: prof, profileUpdatedAt: 0, workouts: [], deletedWorkoutIds: [], customExercises: [], ...o });
const pull = (o: Partial<Pull> = {}): Pull => ({ workouts: [], exercises: [], deleted: [], ...o });

let p = planSync(cd({ workouts: [W(1), W(2)] }), pull(), null);
ok(p.pushWorkouts.length === 2 && p.merged.workouts.length === 2, 'local-only workouts are pushed');

p = planSync(cd(), pull({ workouts: [W(1), W(2)] }), null);
ok(p.merged.workouts.length === 2 && p.pushWorkouts.length === 0, 'cloud-only workouts are pulled, nothing pushed');

p = planSync(cd({ workouts: [W(1), W(2)] }), pull({ workouts: [W(2), W(3)] }), null);
ok(p.merged.workouts.length === 3, 'union without duplicates');
ok(p.pushWorkouts.map((w) => w.id).join() === W(1).id, 'only the missing one is pushed');

p = planSync(cd({ workouts: [W(1), W(2)] }), pull({ workouts: [W(1), W(2)] }), null);
ok(p.pushWorkouts.length === 0 && p.pushExercises.length === 0 && p.deleteIds.length === 0, 'in sync -> nothing to do (idempotent)');

// deletions
p = planSync(cd({ workouts: [], deletedWorkoutIds: [W(1).id] }), pull({ workouts: [W(1), W(2)] }), null);
ok(p.deleteIds.join() === W(1).id, 'local deletion is sent to cloud');
ok(p.merged.workouts.map((w) => w.id).join() === W(2).id, 'deleted workout not kept even though cloud still has it');
p = planSync(cd({ workouts: [W(1), W(2)] }), pull({ workouts: [W(2)], deleted: [W(1).id] }), null);
ok(p.merged.workouts.length === 1 && p.merged.workouts[0].id === W(2).id, 'deletion from other device removes it here');
ok(p.pushWorkouts.length === 0 && p.deleteIds.length === 0, 'and is not pushed back (no resurrection)');

// legacy blob migration
const legacyW = mk('oldid9', 1699000000000);
p = planSync(cd({ workouts: [W(1)] }), pull(), cd({ workouts: [legacyW, mk('w1', 1700000000000 + 86400000)], profileUpdatedAt: 5 }));
ok(p.merged.workouts.length === 2, 'legacy blob workouts migrate; same workout (same legacy id) is not duplicated');
ok(p.merged.workouts.every((w) => UUID_RE.test(w.id)), 'migrated workouts have uuids');
ok(p.pushWorkouts.length === 2, 'migrated workouts are pushed to relational tables');
ok(p.merged.profileUpdatedAt === 5, 'profile timestamp from blob');

// custom exercises from cloud
p = planSync(cd(), pull({ exercises: [{ id: 'custom-1', name: 'Zercher', muscle: 'quads', secondary: ['glutes'], tracking: 'weighted' }] }), null);
ok(p.merged.customExercises[0].muscle === 'Quads' && p.merged.customExercises[0].secondary[0] === 'Glutes', 'cloud muscle ids -> app names');
ok(p.pushExercises.length === 0, 'cloud exercise not re-pushed');
p = planSync(cd({ customExercises: [{ id: 'custom-9', name: 'X', muscle: 'Back' } as any] }), pull(), null);
ok(p.pushExercises.length === 1, 'local custom exercise pushed');

// profile: pull alone must not overwrite a newer local profile
const lp: any = { name: 'local' };
p = planSync(cd({ profile: lp, profileUpdatedAt: 10 }), pull({ workouts: [W(1)] }), null);
ok(p.merged.profile.name === 'local', 'local profile kept when no blob');
p = planSync(cd({ profile: lp, profileUpdatedAt: 10 }), pull(), cd({ profile: { name: 'cloud' } as any, profileUpdatedAt: 20 }));
ok(p.merged.profile.name === 'cloud', 'newer cloud profile wins');
p = planSync(cd({ profile: lp, profileUpdatedAt: 30 }), pull(), cd({ profile: { name: 'cloud' } as any, profileUpdatedAt: 20 }));
ok(p.merged.profile.name === 'local', 'newer local profile wins');

// two devices converge, nothing duplicates, even when syncing in either order
const cloud = { workouts: [] as any[], deleted: [] as string[] };
const run = (local: CloudData) => {
  const pl = planSync(local, pull({ workouts: cloud.workouts, deleted: cloud.deleted }), null);
  for (const w of pl.pushWorkouts) if (!cloud.workouts.some((c) => c.id === w.id)) cloud.workouts.push(w);
  for (const d of pl.deleteIds) { cloud.workouts = cloud.workouts.filter((c) => c.id !== d); if (!cloud.deleted.includes(d)) cloud.deleted.push(d); }
  return pl.merged;
};
let A = cd({ workouts: [W(1), W(2)] }), B = cd({ workouts: [W(3)] });
A = run(A); B = run(B); A = run(A);
ok(A.workouts.length === 3 && B.workouts.length === 3 && cloud.workouts.length === 3, 'two devices converge to 3');
A = { ...A, workouts: A.workouts.filter((w) => w.id !== W(2).id), deletedWorkoutIds: [W(2).id] };
A = run(A); B = run(B);
ok(B.workouts.length === 2 && cloud.workouts.length === 2 && !B.workouts.some((w) => w.id === W(2).id), 'delete on A reaches B and cloud');
const again = run(B); ok(again.workouts.length === 2 && cloud.workouts.length === 2, 'repeat sync changes nothing');
ok(mergeData(A, B).workouts.length === mergeData(B, A).workouts.length, 'merge symmetric');
console.log(fail ? `${fail} FAILURES` : 'ALL PLAN/UUID TESTS PASS');
