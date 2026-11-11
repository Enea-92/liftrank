import { recommend, incrementFor, roundWeight, repRange } from '../src/lib/recommend';
let fail = 0; const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('FAIL', m); } };
const DAY = 86400000; let n = 0;
const wk = (daysAgo: number, id: string, sets: [number, number][]): any => ({
  id: 'w' + ++n, startedAt: Date.now() - daysAgo * DAY, finishedAt: Date.now() - daysAgo * DAY + 3600000, name: 'x',
  exercises: [{ id: 'e' + n, exerciseId: id, sets: sets.map(([w, r], i) => ({ id: `s${n}${i}`, weightKg: w, reps: r, done: true })) }],
});
const bench: any = { id: 'bench-press', equipment: 'Barbell', tracking: 'weighted' };
const squat: any = { id: 'squat', equipment: 'Barbell', tracking: 'weighted' };
const db: any = { id: 'db-curl', equipment: 'Dumbbell', tracking: 'weighted' };

ok(recommend([], bench, 'kg', 'build_muscle') === null, 'no history -> null');
let r = recommend([wk(3, 'bench-press', [[80, 12], [80, 12], [80, 12]])], bench, 'kg', 'build_muscle')!;
ok(r.kind === 'increase' && r.weightKg === 82.5 && r.reps === 8 && r.sets === 3, `hit ceiling -> +2.5 (got ${r.kind} ${r.weightKg}x${r.reps})`);
r = recommend([wk(3, 'bench-press', [[80, 12], [80, 12], [80, 10]])], bench, 'kg', 'build_muscle')!;
ok(r.kind === 'reps' && r.weightKg === 80 && r.reps === 11, 'one set short -> add a rep, same weight');
r = recommend([wk(3, 'bench-press', [[80, 6], [80, 6]])], bench, 'kg', 'build_muscle')!;
ok(r.kind === 'repeat' && r.weightKg === 80 && r.reps === 7, 'below floor -> repeat weight, +1 rep');
r = recommend([wk(3, 'squat', [[100, 6], [100, 6], [100, 6], [100, 6], [100, 6]])], squat, 'kg', 'increase_strength')!;
ok(r.kind === 'increase' && r.weightKg === 105 && r.reps === 4 && r.sets === 5, 'strength goal: 6 reps ceiling, squat +5kg');
ok(repRange('increase_strength')[1] === 6 && repRange(null)[1] === 12, 'rep ranges');
r = recommend([wk(3, 'db-curl', [[14, 12], [14, 12]])], db, 'kg', null)!;
ok(r.weightKg === 16, 'dumbbell +2kg');
// uses the heaviest weight, ignores warm-up sets
r = recommend([wk(3, 'bench-press', [[40, 12], [80, 8], [80, 8]])], bench, 'kg', 'build_muscle')!;
ok(r.weightKg === 80 && r.reps === 9, 'warm-up ignored');
// lb users: increments are 5 lb (2.27 kg), rounded to a 5 lb plate
r = recommend([wk(3, 'bench-press', [[61.235, 12], [61.235, 12]])], bench, 'lb', 'build_muscle')!; // 135 lb
ok(Math.abs(r.weightKg / 0.45359237 - 140) < 0.01, `135 lb -> 140 lb (got ${(r.weightKg / 0.45359237).toFixed(2)})`);
ok(incrementFor(squat, 100, 'lb') === 10 && incrementFor(bench, 80, 'lb') === 5, 'lb increments');
ok(roundWeight(82.4, 'kg') === 82.5 && roundWeight(82.2, 'kg') === 82, 'kg rounding to 0.5');
// stalled: 4+ sessions, last 3 never beat the first
const stalled = [wk(21, 'bench-press', [[80, 8], [80, 8]]), wk(14, 'bench-press', [[80, 8], [80, 7]]), wk(7, 'bench-press', [[80, 8], [80, 7]]), wk(2, 'bench-press', [[80, 7], [80, 7]])];
r = recommend(stalled, bench, 'kg', 'build_muscle')!;
ok(r.kind === 'deload' && r.weightKg === 72 && r.reps === 12, `stall -> deload 90% (got ${r.kind} ${r.weightKg})`);
const progressing = [wk(21, 'bench-press', [[75, 8]]), wk(14, 'bench-press', [[77.5, 8]]), wk(7, 'bench-press', [[80, 8]]), wk(2, 'bench-press', [[80, 9]])];
r = recommend(progressing, bench, 'kg', 'build_muscle')!;
ok(r.kind === 'reps' && r.reps === 10, 'progressing lifter is not deloaded');
ok(recommend(stalled.slice(1), bench, 'kg', 'build_muscle')!.kind !== 'deload', 'needs 4 sessions before calling a stall');
// bodyweight / timed / cardio
r = recommend([wk(2, 'pull-up', [[0, 8], [0, 6]])], { id: 'pull-up', equipment: 'Bodyweight', tracking: 'bodyweight' } as any, 'kg', null)!;
ok(r.kind === 'reps' && r.reps === 7 && r.weightKg === 0, 'bodyweight: lowest set + 1');
r = recommend([wk(2, 'plank', [[0, 45]])], { id: 'plank', equipment: 'Bodyweight', tracking: 'timed' } as any, 'kg', null)!;
ok(r.reps === 50, 'timed +5s');
ok(recommend([wk(2, 'run', [[0, 30]])], { id: 'run', equipment: 'Other', tracking: 'cardio' } as any, 'kg', null) === null, 'cardio: no suggestion');
// uses the most recent session, whatever the order of the array
r = recommend([wk(1, 'bench-press', [[90, 8]]), wk(30, 'bench-press', [[60, 12]])], bench, 'kg', 'build_muscle')!;
ok(r.weightKg === 90, 'most recent session wins regardless of array order');
// never suggests nonsense
for (const gl of ['increase_strength', 'build_muscle', null] as any[]) for (const reps of [1, 3, 5, 8, 12, 20, 40]) {
  const x = recommend([wk(2, 'bench-press', [[100, reps]])], bench, 'kg', gl)!;
  ok(!!x && x.weightKg > 0 && x.reps >= 1 && x.sets >= 1 && x.reason.length > 10, `sane output goal=${gl} reps=${reps}`);
}
console.log(fail ? fail + ' FAILURES' : 'ALL RECOMMEND TESTS PASS');
