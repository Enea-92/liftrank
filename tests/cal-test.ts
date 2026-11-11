import { currentRecords, monthGrid, workoutsByDay, startOfDay } from '../src/lib/stats';
let fail = 0; const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('FAIL', m); } };
const set = (id: string, w: number, r: number) => ({ id, weightKg: w, reps: r, done: true });
const wk = (id: string, t: number, ex: any[]): any => ({ id, name: id, startedAt: t, finishedAt: t + 3600000, exercises: ex });
const D = (y: number, m: number, d: number, h = 18) => new Date(y, m, d, h).getTime();
const ws = [
  wk('c', D(2026, 10, 9), [{ id: 'e3', exerciseId: 'bench', sets: [set('s5', 100, 5), set('s6', 90, 12)] }]),
  wk('a', D(2026, 10, 1), [{ id: 'e1', exerciseId: 'bench', sets: [set('s1', 100, 5), set('s2', 80, 10)] }, { id: 'e2', exerciseId: 'pullup', sets: [set('s3', 0, 8), set('s4', 0, 10)] }]),
];
const r = currentRecords(ws); const b = r.find((x) => x.exerciseId === 'bench')!;
ok(b.maxWeight!.value === 100 && b.maxWeight!.workoutId === 'a', 'tie on max weight keeps the earlier date');
ok(Math.abs(b.best1RM!.value - 90 * (1 + 12 / 30)) < 1e-9 && b.best1RM!.workoutId === 'c', 'best 1RM = 90x12 (126) beats 100x5 (116.7)');
ok(b.bestVolume!.value === 1080 && b.maxReps!.value === 12, 'best volume set and max reps');
const p = r.find((x) => x.exerciseId === 'pullup')!;
ok(!p.maxWeight && !p.best1RM && p.maxReps!.value === 10, 'bodyweight: only max reps');
ok(r[0].exerciseId === 'bench', 'sorted by most recently trained');
ok(currentRecords([]).length === 0, 'empty');
ok(currentRecords([wk('z', 1, [{ id: 'e', exerciseId: 'x', sets: [set('s', 100, 0)] }])]).length === 0, '0-rep sets ignored');

// calendar: Nov 2026 starts on Sunday -> 6 leading nulls (Mon first)
const g = monthGrid(2026, 10);
ok(g.every((w) => w.length === 7), 'weeks have 7 cells');
ok(g[0].filter((c) => c === null).length === 6 && g[0][6] === D(2026, 10, 1, 0), 'Nov 1 2026 (Sunday) is last cell of week 1');
ok(g.flat().filter((c) => c !== null).length === 30, 'November has 30 days');
ok(g.length === 6, 'Nov 2026 spans 6 week rows (6 pad + 30 days)');
const feb = monthGrid(2026, 1); ok(feb.flat().filter((c) => c !== null).length === 28 && feb.length === 5, 'Feb 2026 = 28 days over 5 rows (starts on a Sunday)');
ok(monthGrid(2028, 1).flat().filter((c) => c !== null).length === 29, 'leap year Feb 2028');
// DST: no duplicate or skipped days in a month containing a clock change
const oct = monthGrid(2026, 9).flat().filter((c): c is number => c !== null);
ok(new Set(oct).size === 31 && oct.every((t, i) => new Date(t).getDate() === i + 1), 'month with DST change keeps each day once');
const byDay = workoutsByDay(ws); ok(byDay.size === 2 && byDay.get(startOfDay(D(2026, 10, 9)))!.length === 1, 'grouped by day');
const late = wk('late', new Date(2026, 10, 5, 23, 50).getTime() - 3600000 * 0, []); late.finishedAt = new Date(2026, 10, 6, 0, 20).getTime();
ok(workoutsByDay([late]).has(startOfDay(new Date(2026, 10, 6).getTime())), 'workout finished after midnight counts on the day it finished');
console.log(fail ? fail + ' FAILURES' : 'ALL CALENDAR/RECORD TESTS PASS');
