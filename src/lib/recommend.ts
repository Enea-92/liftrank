import type { Exercise } from '../data/exercises';
import type { Goal, Unit, Workout } from '../store/useStore';
import { estimate1RM } from '../data/ranks';
import { workoutTime } from './stats';

export type RecKind = 'increase' | 'reps' | 'repeat' | 'deload';

export interface Recommendation {
  exerciseId: string;
  kind: RecKind;
  weightKg: number;
  reps: number;
  sets: number;
  /** One plain sentence explaining why. */
  reason: string;
}

const LB = 0.45359237;
const LOWER_BODY = new Set(['squat', 'front-squat', 'deadlift', 'rdl', 'leg-press', 'hip-thrust']);

/** [floor, ceiling] of the rep range worked in. Strength goals use lower reps. */
export function repRange(goal: Goal | null): [number, number] {
  return goal === 'increase_strength' ? [4, 6] : [8, 12];
}

/** Smallest sensible jump, expressed in the user's unit. */
export function incrementFor(ex: Pick<Exercise, 'id' | 'equipment'>, weightKg: number, unit: Unit): number {
  const heavyLower = LOWER_BODY.has(ex.id) && weightKg >= 60;
  if (unit === 'lb') return ex.equipment === 'Dumbbell' ? 5 : heavyLower ? 10 : 5;
  return ex.equipment === 'Dumbbell' ? 2 : heavyLower ? 5 : 2.5;
}

/** Round to a weight that exists on a gym floor: 0.5 kg or 5 lb steps. */
export function roundWeight(kg: number, unit: Unit): number {
  if (unit === 'lb') return Math.round(kg / LB / 5) * 5 * LB;
  return Math.round(kg * 2) / 2;
}

interface Session {
  time: number;
  /** sets that had a weight and reps */
  sets: { weightKg: number; reps: number }[];
}

function sessionsFor(workouts: Workout[], exerciseId: string): Session[] {
  const out: Session[] = [];
  for (const w of workouts) {
    const sets: Session['sets'] = [];
    for (const e of w.exercises)
      if (e.exerciseId === exerciseId) for (const s of e.sets) if (s.reps > 0) sets.push({ weightKg: s.weightKg, reps: s.reps });
    if (sets.length) out.push({ time: workoutTime(w), sets });
  }
  return out.sort((a, b) => a.time - b.time);
}

const best1RM = (s: Session) => s.sets.reduce((m, x) => Math.max(m, estimate1RM(x.weightKg, x.reps)), 0);

/**
 * Double progression: stay at a weight until you can do the top of the rep range on every set,
 * then add weight and drop back to the bottom of the range. If three sessions in a row bring no new
 * best, suggest a lighter session instead of grinding.
 */
export function recommend(
  workouts: Workout[],
  ex: Pick<Exercise, 'id' | 'equipment' | 'tracking'>,
  unit: Unit,
  goal: Goal | null,
): Recommendation | null {
  const sessions = sessionsFor(workouts, ex.id);
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1];
  const nSets = Math.min(6, Math.max(1, last.sets.length));
  const [floor, ceiling] = repRange(goal);

  if (ex.tracking === 'timed') {
    const best = Math.max(...last.sets.map((s) => s.reps));
    return { exerciseId: ex.id, kind: 'reps', weightKg: 0, reps: best + 5, sets: nSets, reason: `You held ${best}s last time. Try for ${best + 5}s.` };
  }
  if (ex.tracking === 'cardio') return null;

  if (ex.tracking === 'bodyweight' || ex.tracking === 'assisted') {
    // bodyweight work progresses by reps; assisted work could also reduce assistance, which we leave to the user
    const minReps = Math.min(...last.sets.map((s) => s.reps));
    const w = last.sets[0].weightKg;
    return {
      exerciseId: ex.id, kind: 'reps', weightKg: w, reps: minReps + 1, sets: nSets,
      reason: `Your lowest set was ${minReps} reps. Aim for ${minReps + 1} on every set.`,
    };
  }

  // weighted
  const top = last.sets.reduce((m, s) => Math.max(m, s.weightKg), 0);
  if (top <= 0) return null;
  const atTop = last.sets.filter((s) => s.weightKg >= top - 1e-9);
  const minReps = Math.min(...atTop.map((s) => s.reps));
  const topSets = Math.min(6, Math.max(atTop.length, nSets));

  if (minReps >= ceiling) {
    const inc = incrementFor(ex, top, unit);
    const next = roundWeight(top + (unit === 'lb' ? inc * LB : inc), unit);
    return {
      exerciseId: ex.id, kind: 'increase', weightKg: next, reps: floor, sets: topSets,
      reason: `You did ${minReps}+ reps on every set at the top weight. Time to go heavier and work back up.`,
    };
  }

  // stalled: at least 4 sessions and the last 3 never beat the best before them
  if (sessions.length >= 4) {
    const before = Math.max(...sessions.slice(0, -3).map(best1RM));
    const recent = sessions.slice(-3).map(best1RM);
    if (recent.every((v) => v <= before + 1e-9)) {
      return {
        exerciseId: ex.id, kind: 'deload', weightKg: roundWeight(top * 0.9, unit), reps: ceiling, sets: topSets,
        reason: 'No new best in your last 3 sessions. A lighter session at about 90% usually helps you push past a plateau.',
      };
    }
  }

  if (minReps < floor) {
    return {
      exerciseId: ex.id, kind: 'repeat', weightKg: top, reps: Math.min(floor, minReps + 1), sets: topSets,
      reason: `Your lowest set was ${minReps} reps. Stay at this weight and build up to ${floor}.`,
    };
  }
  return {
    exerciseId: ex.id, kind: 'reps', weightKg: top, reps: minReps + 1, sets: topSets,
    reason: `Your lowest set was ${minReps} reps. Add a rep to each set; at ${ceiling} reps you move up in weight.`,
  };
}
