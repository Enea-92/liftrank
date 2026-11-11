import { mergeData, normaliseRemote } from '../src/lib/merge';

const p = (bw: number) => ({ unit: 'kg' as const, sex: 'male' as const, bodyweightKg: bw });
const w = (id: string, t: number) => ({ id, startedAt: t, finishedAt: t + 1, name: id, exercises: [] });
const base = { profile: p(75), profileUpdatedAt: 0, workouts: [] as any[], deletedWorkoutIds: [] as string[], customExercises: [] as any[] };

let failed = 0;
const check = (name: string, cond: boolean) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name);
  if (!cond) failed++;
};

// 1. Union of workouts from two devices, newest first
{
  const a = { ...base, workouts: [w('a1', 100), w('a2', 300)] };
  const b = { ...base, workouts: [w('b1', 200)] };
  const m = mergeData(a, b);
  check('union keeps all workouts', m.workouts.length === 3);
  check('sorted newest first', m.workouts.map((x) => x.id).join() === 'a2,b1,a1');
}

// 2. Same workout on both sides is not duplicated
{
  const a = { ...base, workouts: [w('x', 100)] };
  const b = { ...base, workouts: [w('x', 100)] };
  check('no duplicates', mergeData(a, b).workouts.length === 1);
}

// 3. Deletion on one device wins over the copy still on the other device
{
  const a = { ...base, workouts: [], deletedWorkoutIds: ['x'] };
  const b = { ...base, workouts: [w('x', 100), w('y', 200)] };
  const m = mergeData(a, b);
  check('deleted workout stays deleted', !m.workouts.some((x) => x.id === 'x'));
  check('other workouts survive', m.workouts.some((x) => x.id === 'y'));
  check('tombstone kept for other devices', m.deletedWorkoutIds.includes('x'));
}

// 4. Newer profile wins, in both argument orders
{
  const a = { ...base, profile: p(80), profileUpdatedAt: 2000 };
  const b = { ...base, profile: p(70), profileUpdatedAt: 1000 };
  check('newer profile wins (a,b)', mergeData(a, b).profile.bodyweightKg === 80);
  check('newer profile wins (b,a)', mergeData(b, a).profile.bodyweightKg === 80);
}

// 5. Custom exercises union
{
  const e = (id: string) => ({ id, name: id, muscle: 'Chest' as const, ranked: false });
  const m = mergeData({ ...base, customExercises: [e('c1')] }, { ...base, customExercises: [e('c2'), e('c1')] });
  check('custom exercises unioned', m.customExercises.length === 2);
}

// 6. Merge is convergent: both devices end up with the same data
{
  const a = { ...base, workouts: [w('a', 1)], deletedWorkoutIds: ['z'] };
  const b = { ...base, workouts: [w('b', 2), w('z', 3)] };
  const ids = (d: any) => d.workouts.map((x: any) => x.id).sort().join();
  check('convergent', ids(mergeData(a, b)) === ids(mergeData(b, a)));
}

// 7. Garbage / empty cloud JSON is tolerated
{
  const n = normaliseRemote({}, p(75));
  check('empty remote normalised', n.workouts.length === 0 && n.profile.bodyweightKg === 75);
  const n2 = normaliseRemote(null, p(60));
  check('null remote normalised', n2.profile.bodyweightKg === 60);
}

console.log(failed === 0 ? 'ALL PASSED' : `${failed} FAILED`);
process.exit(failed ? 1 : 0);
