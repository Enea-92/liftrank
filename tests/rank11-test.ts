import { RANKS, STANDARDS, rankFor, estimate1RM, rankFromScore } from '../src/data/ranks';
let fail = 0; const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('FAIL', m); } };
ok(RANKS.length === 11 && RANKS[0] === 'Newbie' && RANKS[10] === 'GOAT', '11 names');
for (const [id, s] of Object.entries(STANDARDS)) for (const sex of ['male', 'female'] as const) {
  const t = s[sex]; ok(t.length === 10, id + ' len');
  for (let i = 1; i < t.length; i++) ok(t[i] > t[i - 1], `${id} ${sex} ascending`);
  ok(s.female[9] < s.male[9] || id === 'x', id + ' female goat <= male');
  // each threshold lands exactly on rank i+1, just below lands on rank i
  for (let i = 0; i < 10; i++) {
    const at = rankFor(id, t[i] * 80 * 1.000001, 80, sex)!; ok(at.rankIndex === i + 1, `${id} ${sex} at ${i}: ${at.rankIndex}`);
    const below = rankFor(id, t[i] * 80 * 0.99999, 80, sex)!; ok(below.rankIndex === i, `${id} ${sex} below ${i}: ${below.rankIndex}`);
  }
  const top = rankFor(id, t[9] * 80 * 2, 80, sex)!; ok(top.rank === 'GOAT' && top.score === 11 && !top.nextTarget, id + ' top');
  const tiny = rankFor(id, 1, 80, sex)!; ok(tiny.rank === 'Newbie' && tiny.score < 1, id + ' newbie');
}
ok(rankFor('bench-press', 0, 80, 'male') === null && rankFor('nope', 100, 80, 'male') === null && rankFor('bench-press', 100, 0, 'male') === null, 'null cases');
ok(rankFromScore(11).rank === 'GOAT' && rankFromScore(-3).rank === 'Newbie' && rankFromScore(4.99).rank === 'Semi-Pro', 'fromScore');
const b = rankFor('bench-press', estimate1RM(100, 5), 80, 'male')!; console.log('100x5 @80kg male bench ->', b.rank, b.score.toFixed(2));
console.log('bench male x BW:', STANDARDS['bench-press'].male.map((x) => x.toFixed(2)).join(' '));
console.log(fail ? `${fail} FAILURES` : 'ALL RANK TESTS PASS');
