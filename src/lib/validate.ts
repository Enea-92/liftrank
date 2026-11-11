import type { Profile } from '../store/useStore';

export type Errors = Partial<Record<string, string>>;

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Parse YYYY-MM-DD into a real date (rejects 2001-02-31 etc). */
export function parseDob(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
}

export function ageOn(dob: Date, now: Date): number {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function validateBasics(p: Pick<Profile, 'name' | 'username' | 'dob' | 'country'>, now = new Date()): Errors {
  const e: Errors = {};
  const name = p.name.trim();
  if (name.length < 2) e.name = 'Enter your name (at least 2 characters).';
  else if (name.length > 60) e.name = 'Name is too long (60 characters max).';
  if (!USERNAME_RE.test(p.username)) e.username = 'Username: 3-20 characters, lowercase letters, numbers and underscores only.';
  if (!p.dob) e.dob = 'Enter your date of birth as YYYY-MM-DD.';
  else {
    const d = parseDob(p.dob);
    if (!d) e.dob = 'Use the format YYYY-MM-DD, for example 1998-04-23.';
    else {
      const age = ageOn(d, now);
      if (age < 13) e.dob = 'You must be at least 13 years old to use this app.';
      else if (age > 100) e.dob = 'Please check the year.';
    }
  }
  return e;
}

export function validateBody(p: Pick<Profile, 'bodyweightKg' | 'heightCm'>): Errors {
  const e: Errors = {};
  if (!(p.bodyweightKg >= 20 && p.bodyweightKg <= 400)) e.weight = 'Enter a bodyweight between 20 and 400 kg (44 to 880 lb).';
  if (p.heightCm !== null && !(p.heightCm >= 80 && p.heightCm <= 260)) e.height = 'Height must be between 80 and 260 cm.';
  return e;
}

export function validateTraining(p: Pick<Profile, 'experience' | 'goal' | 'sessionsPerWeek' | 'durationMin'>): Errors {
  const e: Errors = {};
  if (!p.experience) e.experience = 'Choose your experience level.';
  if (!p.goal) e.goal = 'Choose your main goal.';
  if (!(p.sessionsPerWeek >= 1 && p.sessionsPerWeek <= 7)) e.sessions = 'Choose 1 to 7 sessions per week.';
  if (!(p.durationMin >= 10 && p.durationMin <= 300)) e.duration = 'Choose a duration between 10 and 300 minutes.';
  return e;
}

/** Parse a user-typed decimal ("72,5" or "72.5"). Returns NaN when it is not a number. */
export function parseNum(t: string): number {
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Turn a display name into a suggested username. */
export function suggestUsername(name: string): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base.slice(0, 20);
}
