import {
  startOfWeek, weekActivity, weekStreak, consistency, personalRecords, biggestImprovement, totals, DAY,
} from '../src/lib/stats';

let failed = 0;
const check = (name: string, cond: boolean, extra?: any) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + JSON.stringify(extra)));
  if (!cond) failed++;
};

// Wednesday 11 Nov 2026, 12:00 local
const now = new Date(2026, 10, 11, 12, 0, 0).getTime();
const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).getTime();

let n = 0;
const wk = (t: number, ex: string, sets: [number, number][]) => ({
  id: 'w' + n++,
  startedAt: t,
  finishedAt: t + 3600000,
  name: 'x',
  exercises: [{ id: 'e' + n, exerciseId: ex, sets: sets.map(([w, r], i) => ({ id: 's' + i, weightKg: w, reps: r, done: true })) }],
}) as any;

// ---- week boundaries (Monday start)
check('startOfWeek is Monday 9 Nov', new Date(startOfWeek(now)).getDate() === 9 && new Date(startOfWeek(now)).getDay() === 1);
check('Sunday belongs to the previous Monday', new Date(startOfWeek(at(2026, 11, 15))).getDate() === 9);
check('Monday 00:00 is itself', startOfWeek(new Date(2026, 10, 9, 0, 0).getTime()) === new Date(2026, 10, 9, 0, 0).getTime());

// ---- week activity: Mon 9 and Tue 10 this week, plus last Friday (not this week)
const A = [wk(at(2026, 11, 9), 'bench-press', [[100, 5]]), wk(at(2026, 11, 10), 'squat', [[100, 5]]), wk(at(2026, 11, 6), 'squat', [[90, 5]])];
const wa = weekActivity(A, now);
check('week sessions = 2', wa.sessions === 2, wa.sessions);
check('Mon/Tue marked, Fri last week excluded', wa.days[0].count === 1 && wa.days[1].count === 1 && wa.days.reduce((a, d) => a + d.count, 0) === 2);
check('today is Wednesday', wa.days[2].isToday && !wa.days[0].isToday);
check('week volume = 500+500', wa.volumeKg === 1000, wa.volumeKg);

// ---- streak: goal 2/week
const S = [
  wk(at(2026, 11, 9), 'a', [[1, 1]]), wk(at(2026, 11, 10), 'a', [[1, 1]]), // this week: 2 (met)
  wk(at(2026, 11, 2), 'a', [[1, 1]]), wk(at(2026, 11, 4), 'a', [[1, 1]]), // last week: 2
  wk(at(2026, 10, 26), 'a', [[1, 1]]), // week before: only 1 -> breaks
];
check('streak = 2 weeks (this + last)', weekStreak(S, 2, now) === 2, weekStreak(S, 2, now));
check('in-progress week does not break streak', weekStreak([S[2], S[3], S[4]], 2, now) === 1, weekStreak([S[2], S[3], S[4]], 2, now));
check('no workouts -> streak 0', weekStreak([], 3, now) === 0);
check('consistency: 1 of 2 weeks goal met in a 2 week window', Math.abs(consistency([S[2], S[3]], 2, now, 2) - 0.5) < 1e-9, consistency([S[2], S[3]], 2, now, 2));

// ---- PRs: bench 100x5 (1RM 116.7) -> 100x8 (126.7) -> 100x3 (110, no PR) -> 105x3 (115.5 weight PR only)
const P = [
  wk(at(2026, 10, 1), 'bench-press', [[100, 5]]),
  wk(at(2026, 10, 8), 'bench-press', [[100, 8]]),
  wk(at(2026, 10, 15), 'bench-press', [[100, 3]]),
  wk(at(2026, 10, 22), 'bench-press', [[105, 3]]),
];
const prs = personalRecords(P);
check('first session sets baseline, not a PR', !prs.some((p) => p.date === P[0].finishedAt));
check('rep PR at same weight counts as 1RM PR only', prs.filter((p) => p.workoutId === P[1].id).map((p) => p.type).join() === 'est_1rm');
check('worse session gives no PR', !prs.some((p) => p.workoutId === P[2].id));
check('heavier weight with lower 1RM is a weight PR only', prs.filter((p) => p.workoutId === P[3].id).map((p) => p.type).join() === 'max_weight', prs);
check('PR carries previous value', Math.abs(prs.find((p) => p.type === 'est_1rm')!.previous - 100 * (1 + 5 / 30)) < 1e-9);
check('order-independent (input reversed)', personalRecords([...P].reverse()).length === prs.length);

// ---- biggest improvement in the last 30 days
const I = [
  wk(now - 60 * DAY, 'squat', [[100, 5]]), // before window baseline
  wk(now - 10 * DAY, 'squat', [[120, 5]]), // +20%
  wk(now - 60 * DAY, 'bench-press', [[80, 5]]),
  wk(now - 5 * DAY, 'bench-press', [[84, 5]]), // +5%
  wk(now - 3 * DAY, 'deadlift', [[150, 5]]), // only in window, single point: 0%
];
const bi = biggestImprovement(I, now, 30);
check('biggest improvement is squat +20%', bi?.exerciseId === 'squat' && Math.abs(bi.pct - 0.2) < 1e-9, bi);
check('no improvement when nothing grew', biggestImprovement([wk(now - 2 * DAY, 'squat', [[100, 5]])], now, 30) === null);

// ---- totals
check('totals volume', totals(A).volumeKg === 500 + 500 + 450 && totals(A).count === 3, totals(A));

console.log(failed === 0 ? 'ALL PASSED' : `${failed} FAILED`);
process.exit(failed ? 1 : 0);
