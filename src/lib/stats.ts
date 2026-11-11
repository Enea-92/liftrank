import type { Workout } from '../store/useStore';
import { estimate1RM } from '../data/ranks';

export const DAY = 86400000;

export const workoutTime = (w: Workout) => w.finishedAt ?? w.startedAt;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 of the week containing ts. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

const addDays = (ts: number, n: number) => {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

export function workoutVolume(w: Workout): number {
  let v = 0;
  for (const e of w.exercises) for (const s of e.sets) v += s.weightKg * s.reps;
  return v;
}

export function totals(workouts: Workout[]) {
  return { count: workouts.length, volumeKg: workouts.reduce((a, w) => a + workoutVolume(w), 0) };
}

const inRange = (w: Workout, from: number, to: number) => {
  const t = workoutTime(w);
  return t >= from && t < to;
};

export interface WeekActivity {
  /** Monday..Sunday */
  days: { ts: number; count: number; isToday: boolean }[];
  sessions: number;
  volumeKg: number;
}

export function weekActivity(workouts: Workout[], now: number): WeekActivity {
  const ws = startOfWeek(now);
  const today = startOfDay(now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const ts = addDays(ws, i);
    const next = addDays(ws, i + 1);
    return { ts, count: workouts.filter((w) => inRange(w, ts, next)).length, isToday: ts === today };
  });
  const inWeek = workouts.filter((w) => inRange(w, ws, addDays(ws, 7)));
  return {
    days,
    sessions: inWeek.length,
    volumeKg: inWeek.reduce((a, w) => a + workoutVolume(w), 0),
  };
}

const sessionsInWeek = (workouts: Workout[], weekStart: number) =>
  workouts.filter((w) => inRange(w, weekStart, addDays(weekStart, 7))).length;

/**
 * Number of consecutive weeks (Mon-Sun) in which the weekly session goal was met.
 * The current week counts if already met, but does not break the streak while it is still in progress.
 */
export function weekStreak(workouts: Workout[], goal: number, now: number): number {
  const g = Math.max(1, goal);
  let ws = startOfWeek(now);
  let streak = 0;
  if (sessionsInWeek(workouts, ws) >= g) streak++;
  ws = addDays(ws, -7);
  while (streak < 520 && sessionsInWeek(workouts, ws) >= g) {
    streak++;
    ws = addDays(ws, -7);
  }
  return streak;
}

/** Average goal completion (0..1) over the last `weeks` weeks, including the current one. */
export function consistency(workouts: Workout[], goal: number, now: number, weeks = 4): number {
  const g = Math.max(1, goal);
  let ws = startOfWeek(now);
  let sum = 0;
  for (let i = 0; i < weeks; i++) {
    sum += Math.min(1, sessionsInWeek(workouts, ws) / g);
    ws = addDays(ws, -7);
  }
  return sum / weeks;
}

// ---------- exercise-level stats ----------

interface Session {
  exerciseId: string;
  time: number;
  workoutId: string;
  topWeight: number;
  best1RM: number;
}

function sessions(workouts: Workout[]): Session[] {
  const out: Session[] = [];
  for (const w of workouts) {
    const byEx = new Map<string, { top: number; orm: number }>();
    for (const e of w.exercises)
      for (const s of e.sets) {
        if (s.weightKg <= 0 || s.reps <= 0) continue;
        const cur = byEx.get(e.exerciseId) ?? { top: 0, orm: 0 };
        cur.top = Math.max(cur.top, s.weightKg);
        cur.orm = Math.max(cur.orm, estimate1RM(s.weightKg, s.reps));
        byEx.set(e.exerciseId, cur);
      }
    for (const [exerciseId, v] of byEx)
      out.push({ exerciseId, time: workoutTime(w), workoutId: w.id, topWeight: v.top, best1RM: v.orm });
  }
  return out.sort((a, b) => a.time - b.time);
}

export interface PREvent {
  exerciseId: string;
  type: 'max_weight' | 'est_1rm';
  value: number;
  previous: number;
  date: number;
  workoutId: string;
}

/**
 * Chronologically scan workouts and report every time a session beat the previous best
 * weight or estimated 1RM for an exercise. The first session of an exercise sets the baseline
 * and is not counted as a PR.
 */
export function personalRecords(workouts: Workout[]): PREvent[] {
  const best = new Map<string, { w: number; orm: number }>();
  const events: PREvent[] = [];
  for (const s of sessions(workouts)) {
    const prev = best.get(s.exerciseId);
    if (prev) {
      if (s.topWeight > prev.w + 1e-9)
        events.push({ exerciseId: s.exerciseId, type: 'max_weight', value: s.topWeight, previous: prev.w, date: s.time, workoutId: s.workoutId });
      if (s.best1RM > prev.orm + 1e-9)
        events.push({ exerciseId: s.exerciseId, type: 'est_1rm', value: s.best1RM, previous: prev.orm, date: s.time, workoutId: s.workoutId });
    }
    best.set(s.exerciseId, { w: Math.max(prev?.w ?? 0, s.topWeight), orm: Math.max(prev?.orm ?? 0, s.best1RM) });
  }
  return events;
}

export interface Improvement {
  exerciseId: string;
  pct: number;
  from: number;
  to: number;
}

/** Exercise whose estimated 1RM grew the most (in %) over the last `days` days. */
export function biggestImprovement(workouts: Workout[], now: number, days = 30): Improvement | null {
  const cutoff = now - days * DAY;
  const byEx = new Map<string, Session[]>();
  for (const s of sessions(workouts)) {
    if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []);
    byEx.get(s.exerciseId)!.push(s);
  }
  let best: Improvement | null = null;
  for (const [exerciseId, list] of byEx) {
    const before = list.filter((s) => s.time < cutoff).reduce((m, s) => Math.max(m, s.best1RM), 0);
    const inWin = list.filter((s) => s.time >= cutoff);
    if (!inWin.length) continue;
    const baseline = before > 0 ? before : inWin[0].best1RM;
    const top = inWin.reduce((m, s) => Math.max(m, s.best1RM), 0);
    const pct = baseline > 0 ? (top - baseline) / baseline : 0;
    if (pct > 0 && (!best || pct > best.pct)) best = { exerciseId, pct, from: baseline, to: top };
  }
  return best;
}

export type Period = '7d' | '30d' | '90d' | '1y' | 'all';
export const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '1y', label: '1 year', days: 365 },
  { key: 'all', label: 'All time', days: null },
];

export const periodCutoff = (p: Period, now: number): number => {
  const d = PERIODS.find((x) => x.key === p)?.days;
  return d ? now - d * DAY : 0;
};

// ---------- current personal records ----------

export interface RecordSet {
  value: number;
  weightKg: number;
  reps: number;
  date: number;
  workoutId: string;
}

export interface ExerciseRecords {
  exerciseId: string;
  maxWeight?: RecordSet; // heaviest weight lifted
  best1RM?: RecordSet; // best estimated one-rep max
  bestVolume?: RecordSet; // best single set by weight x reps
  maxReps?: RecordSet; // most reps in one set (useful for bodyweight work)
  lastDate: number;
}

/**
 * The best set per record type for every exercise. Ties go to whoever got there first,
 * so a record's date is when it was first set.
 */
export function currentRecords(workouts: Workout[]): ExerciseRecords[] {
  const out = new Map<string, ExerciseRecords>();
  const chronological = [...workouts].sort((a, b) => workoutTime(a) - workoutTime(b));
  for (const w of chronological) {
    const date = workoutTime(w);
    for (const e of w.exercises)
      for (const s of e.sets) {
        if (s.reps <= 0) continue;
        const r = out.get(e.exerciseId) ?? { exerciseId: e.exerciseId, lastDate: date };
        r.lastDate = Math.max(r.lastDate, date);
        const mk = (value: number): RecordSet => ({ value, weightKg: s.weightKg, reps: s.reps, date, workoutId: w.id });
        if (!r.maxReps || s.reps > r.maxReps.value) r.maxReps = mk(s.reps);
        if (s.weightKg > 0) {
          if (!r.maxWeight || s.weightKg > r.maxWeight.value) r.maxWeight = mk(s.weightKg);
          const orm = estimate1RM(s.weightKg, s.reps);
          if (!r.best1RM || orm > r.best1RM.value + 1e-9) r.best1RM = mk(orm);
          const vol = s.weightKg * s.reps;
          if (!r.bestVolume || vol > r.bestVolume.value + 1e-9) r.bestVolume = mk(vol);
        }
        out.set(e.exerciseId, r);
      }
  }
  return [...out.values()].sort((a, b) => b.lastDate - a.lastDate);
}

// ---------- calendar ----------

/** Workouts grouped by the local day they happened on (key = local midnight timestamp). */
export function workoutsByDay(workouts: Workout[]): Map<number, Workout[]> {
  const map = new Map<number, Workout[]>();
  for (const w of workouts) {
    const k = startOfDay(workoutTime(w));
    const list = map.get(k) ?? [];
    list.push(w);
    map.set(k, list);
  }
  for (const list of map.values()) list.sort((a, b) => workoutTime(a) - workoutTime(b));
  return map;
}

/** Weeks (Monday first) of a month; each cell is the local-midnight timestamp of that day, or null for padding. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d).getTime());
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ---------- analytics ----------

export interface WeekBucket {
  start: number; // Monday 00:00
  sessions: number;
  sets: number;
  volumeKg: number;
}

/** The last `weeks` calendar weeks (Mon-Sun), oldest first, including empty weeks. */
export function weeklyBuckets(workouts: Workout[], weeks: number, now: number): WeekBucket[] {
  const thisWeek = startOfWeek(now);
  const out: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    const ws = workouts.filter((w) => inRange(w, start, end));
    out.push({
      start,
      sessions: ws.length,
      sets: ws.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0),
      volumeKg: ws.reduce((a, w) => a + workoutVolume(w), 0),
    });
  }
  return out;
}

export interface GroupTotals {
  sets: number;
  volumeKg: number;
}

/** Sets and volume per group (muscle, category...) since a cutoff. `groupOf` returns undefined to skip an exercise. */
export function groupTotals(
  workouts: Workout[],
  groupOf: (exerciseId: string) => string | undefined,
  since: number,
): Record<string, GroupTotals> {
  const out: Record<string, GroupTotals> = {};
  for (const w of workouts) {
    if (workoutTime(w) < since) continue;
    for (const e of w.exercises) {
      const g = groupOf(e.exerciseId);
      if (!g) continue;
      const t = (out[g] ??= { sets: 0, volumeKg: 0 });
      for (const s of e.sets) {
        t.sets += 1;
        t.volumeKg += s.weightKg * s.reps;
      }
    }
  }
  return out;
}

export interface ExerciseTotal {
  exerciseId: string;
  sets: number;
  sessions: number;
  volumeKg: number;
}

/** Lifetime totals per exercise, most volume first. */
export function exerciseTotals(workouts: Workout[]): ExerciseTotal[] {
  const map = new Map<string, ExerciseTotal>();
  for (const w of workouts)
    for (const e of w.exercises) {
      const t = map.get(e.exerciseId) ?? { exerciseId: e.exerciseId, sets: 0, sessions: 0, volumeKg: 0 };
      t.sessions += 1;
      for (const s of e.sets) {
        t.sets += 1;
        t.volumeKg += s.weightKg * s.reps;
      }
      map.set(e.exerciseId, t);
    }
  return [...map.values()].sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets);
}

/** Average workout length in ms over workouts that have a finish time. */
export function averageDuration(workouts: Workout[]): number {
  const ds = workouts.filter((w) => w.finishedAt).map((w) => w.finishedAt! - w.startedAt);
  return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0;
}
