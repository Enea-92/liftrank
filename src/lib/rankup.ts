/** Rank levels (0 = Newbie ... 10 = GOAT) at one moment: overall, per muscle and per lift. */
export interface RankSnapshot {
  overall: number | null;
  muscles: Record<string, number | null>;
  lifts: Record<string, number>;
}

export interface RankUp {
  scope: 'overall' | 'muscle' | 'lift';
  /** muscle name or exercise id (empty for overall) */
  key: string;
  from: number;
  to: number;
}

/**
 * What moved up between two snapshots. Something that was unranked counts as starting from Newbie
 * (level 0), so a first lift only shows up if it already lands above Newbie. Ranks never "go down"
 * here: a drop (for example after a bodyweight change) is simply not reported.
 * Ordered with the most important first: overall, then muscles, then lifts.
 */
export function diffRanks(before: RankSnapshot, after: RankSnapshot): RankUp[] {
  const out: RankUp[] = [];
  if (after.overall !== null && after.overall > (before.overall ?? 0)) {
    out.push({ scope: 'overall', key: '', from: before.overall ?? 0, to: after.overall });
  }
  for (const [m, to] of Object.entries(after.muscles)) {
    if (to !== null && to > (before.muscles[m] ?? 0)) out.push({ scope: 'muscle', key: m, from: before.muscles[m] ?? 0, to });
  }
  for (const [id, to] of Object.entries(after.lifts)) {
    if (to > (before.lifts[id] ?? 0)) out.push({ scope: 'lift', key: id, from: before.lifts[id] ?? 0, to });
  }
  return out;
}
