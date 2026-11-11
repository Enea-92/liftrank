import { Muscle } from './exercises';

/** 11 levels, lowest to highest. Level number (for the database) is index + 1. */
export const RANKS = [
  'Newbie', 'Starter', 'Apprentice', 'Lifter', 'Semi-Pro', 'Pro',
  'Elite', 'Master', 'Grandmaster', 'Titan', 'GOAT',
] as const;
export type RankName = (typeof RANKS)[number];

export const RANK_COLORS: Record<RankName, string> = {
  Newbie: '#8E8E93',
  Starter: '#9BA8B5',
  Apprentice: '#64B5F6',
  Lifter: '#4DD0A5',
  'Semi-Pro': '#9CCC65',
  Pro: '#FFD54F',
  Elite: '#FFB74D',
  Master: '#FF7043',
  Grandmaster: '#F06292',
  Titan: '#C084FC',
  GOAT: '#FFD700',
};

/**
 * Approximate strength standards. Each lift has six anchor multiples (estimated 1RM / bodyweight)
 * loosely based on commonly published population tables. They are guidelines, not science.
 * The 10 thresholds between Starter and GOAT are spread evenly between
 *   Starter = 0.6 x first anchor   and   GOAT = 1.25 x last anchor.
 * Below the Starter threshold you are a Newbie.
 */
type Anchors = { male: number[]; female: number[] };

const BASE: Record<string, Anchors> = {
  'bench-press': { male: [0.5, 0.75, 1.0, 1.5, 1.75, 2.0], female: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5] },
  'incline-bench': { male: [0.4, 0.65, 0.9, 1.25, 1.5, 1.75], female: [0.2, 0.4, 0.6, 0.85, 1.1, 1.3] },
  'close-grip-bench': { male: [0.4, 0.6, 0.85, 1.2, 1.45, 1.7], female: [0.2, 0.35, 0.55, 0.8, 1.0, 1.2] },
  deadlift: { male: [0.75, 1.25, 1.75, 2.25, 2.75, 3.0], female: [0.5, 0.75, 1.25, 1.75, 2.25, 2.5] },
  'barbell-row': { male: [0.4, 0.65, 0.9, 1.25, 1.5, 1.75], female: [0.2, 0.4, 0.6, 0.85, 1.1, 1.3] },
  'overhead-press': { male: [0.35, 0.5, 0.7, 0.9, 1.1, 1.3], female: [0.2, 0.3, 0.45, 0.6, 0.8, 0.95] },
  'barbell-curl': { male: [0.2, 0.4, 0.6, 0.85, 1.1, 1.3], female: [0.1, 0.2, 0.4, 0.6, 0.8, 1.0] },
  squat: { male: [0.6, 1.0, 1.5, 2.0, 2.5, 2.75], female: [0.4, 0.75, 1.0, 1.5, 2.0, 2.25] },
  'front-squat': { male: [0.5, 0.8, 1.2, 1.6, 2.0, 2.25], female: [0.3, 0.6, 0.85, 1.2, 1.6, 1.8] },
  'lat-pulldown': { male: [0.5, 0.75, 1.0, 1.35, 1.6, 1.9], female: [0.3, 0.5, 0.7, 0.95, 1.2, 1.4] },
  'leg-press': { male: [1.0, 1.75, 2.5, 3.25, 4.0, 4.75], female: [0.75, 1.25, 1.75, 2.5, 3.25, 3.75] },
  rdl: { male: [0.5, 0.85, 1.25, 1.65, 2.0, 2.4], female: [0.3, 0.55, 0.85, 1.2, 1.6, 1.9] },
  'hip-thrust': { male: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0], female: [0.4, 0.8, 1.2, 1.7, 2.1, 2.6] },
  'calf-raise': { male: [0.5, 0.9, 1.3, 1.8, 2.3, 2.8], female: [0.3, 0.6, 0.9, 1.3, 1.7, 2.1] },
  'cable-crunch': { male: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5], female: [0.15, 0.3, 0.5, 0.7, 0.9, 1.1] },
};

const STEPS = RANKS.length - 1; // 10 thresholds: Starter..GOAT

export function buildThresholds(anchors: number[]): number[] {
  const lo = anchors[0] * 0.6;
  const hi = anchors[anchors.length - 1] * 1.25;
  return Array.from({ length: STEPS }, (_, j) => lo + ((hi - lo) * j) / (STEPS - 1));
}

type Standards = { male: number[]; female: number[] };

/** Bodyweight multiples needed for Starter..GOAT (10 values, ascending). */
export const STANDARDS: Record<string, Standards> = Object.fromEntries(
  Object.entries(BASE).map(([id, a]) => [id, { male: buildThresholds(a.male), female: buildThresholds(a.female) }]),
);

export type Sex = 'male' | 'female';

export interface RankResult {
  rank: RankName;
  rankIndex: number; // 0..10 (level = index + 1)
  /** 0..1 progress toward the next rank (1 when at top rank). */
  progressToNext: number;
  /** Continuous score 0..11 used for averaging muscle groups. */
  score: number;
  nextTarget?: number; // 1RM (kg) needed for next rank
}

/** Epley formula. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function rankFor(
  exerciseId: string,
  oneRepMaxKg: number,
  bodyweightKg: number,
  sex: Sex,
): RankResult | null {
  const th = STANDARDS[exerciseId]?.[sex];
  if (!th || bodyweightKg <= 0 || oneRepMaxKg <= 0) return null;
  const ratio = oneRepMaxKg / bodyweightKg;

  // Number of thresholds reached: 0 = Newbie ... 10 = GOAT.
  let idx = 0;
  for (let i = 0; i < th.length; i++) if (ratio >= th[i]) idx = i + 1;

  const isTop = idx === th.length;
  const lower = idx === 0 ? 0 : th[idx - 1];
  const upper = isTop ? lower : th[idx];
  const progress = isTop ? 1 : (ratio - lower) / (upper - lower);

  return {
    rank: RANKS[idx],
    rankIndex: idx,
    progressToNext: Math.max(0, Math.min(1, progress)),
    // below the next threshold the score stays strictly under idx + 1
    score: isTop ? RANKS.length : idx + Math.min(0.999, progress),
    nextTarget: isTop ? undefined : th[idx] * bodyweightKg,
  };
}

export function rankFromScore(score: number): { rank: RankName; rankIndex: number } {
  const idx = Math.max(0, Math.min(RANKS.length - 1, Math.floor(score)));
  return { rank: RANKS[idx], rankIndex: idx };
}

export type MuscleScores = Partial<Record<Muscle, number>>;
