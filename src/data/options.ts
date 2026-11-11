import type { Experience, Gender, Goal } from '../store/useStore';

export const GOALS: { key: Goal; label: string }[] = [
  { key: 'build_muscle', label: 'Build muscle' },
  { key: 'increase_strength', label: 'Increase strength' },
  { key: 'lose_fat', label: 'Lose fat' },
  { key: 'improve_fitness', label: 'Improve fitness' },
  { key: 'general_health', label: 'General health' },
];

export const EXPERIENCE: { key: Experience; label: string; hint: string }[] = [
  { key: 'beginner', label: 'Beginner', hint: 'Under 1 year of regular lifting' },
  { key: 'intermediate', label: 'Intermediate', hint: '1 to 3 years' },
  { key: 'advanced', label: 'Advanced', hint: 'More than 3 years' },
];

export const GENDERS: { key: Gender; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
  { key: 'prefer_not', label: 'Prefer not to say' },
];

/** Monday-first order; value is JS getDay() (0 = Sunday). */
export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: 'M', long: 'Mon' },
  { value: 2, short: 'T', long: 'Tue' },
  { value: 3, short: 'W', long: 'Wed' },
  { value: 4, short: 'T', long: 'Thu' },
  { value: 5, short: 'F', long: 'Fri' },
  { value: 6, short: 'S', long: 'Sat' },
  { value: 0, short: 'S', long: 'Sun' },
];

export const DURATIONS = [30, 45, 60, 75, 90, 120];
