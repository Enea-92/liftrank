import type { TrackingType } from '../data/exercises';
import type { SetEntry, Unit } from '../store/useStore';
import { toDisplay } from '../store/useStore';

export const fmtKg = (kg: number, unit: Unit) => `${toDisplay(kg, unit)} ${unit}`;

/** Compact text for one set, depending on how the exercise is tracked. */
export function fmtSet(s: Pick<SetEntry, 'weightKg' | 'reps'>, t: TrackingType, unit: Unit): string {
  const w = toDisplay(s.weightKg, unit);
  switch (t) {
    case 'weighted':
      return `${w} × ${s.reps}`;
    case 'bodyweight':
      return s.weightKg > 0 ? `+${w} × ${s.reps}` : `${s.reps} reps`;
    case 'assisted':
      return `-${w} × ${s.reps}`;
    case 'timed':
      return `${s.reps}s`;
    case 'cardio':
      return `${s.reps} min`;
  }
}
