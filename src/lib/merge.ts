import type { Exercise, Muscle } from '../data/exercises';
import { UUID_RE, toUuid, uuidifyWorkout } from './uuid';
import type { Profile, Workout } from '../store/useStore';

/** The slice of app data that is stored in the cloud (the active, unfinished workout stays local). */
export interface CloudData {
  profile: Profile;
  profileUpdatedAt: number;
  workouts: Workout[];
  deletedWorkoutIds: string[];
  customExercises: Exercise[];
}

/**
 * Merge two copies of a user's data (e.g. this device and the cloud).
 * - Workouts: union by id, minus anything deleted on either side (finished workouts are immutable).
 * - Custom exercises: union by id.
 * - Profile: the most recently edited copy wins.
 * The function is symmetric in outcome, so devices converge no matter who syncs first.
 */
export function mergeData(a: CloudData, b: CloudData): CloudData {
  const deleted = new Set<string>([...(a.deletedWorkoutIds ?? []), ...(b.deletedWorkoutIds ?? [])]);

  const byId = new Map<string, Workout>();
  for (const w of [...(b.workouts ?? []), ...(a.workouts ?? [])]) {
    if (!deleted.has(w.id)) byId.set(w.id, w);
  }
  const workouts = [...byId.values()].sort((x, y) => (y.finishedAt ?? y.startedAt) - (x.finishedAt ?? x.startedAt));

  const exById = new Map<string, Exercise>();
  for (const e of [...(b.customExercises ?? []), ...(a.customExercises ?? [])]) exById.set(e.id, e);

  const aNewer = (a.profileUpdatedAt ?? 0) >= (b.profileUpdatedAt ?? 0);
  return {
    profile: aNewer ? a.profile : b.profile,
    profileUpdatedAt: Math.max(a.profileUpdatedAt ?? 0, b.profileUpdatedAt ?? 0),
    workouts,
    deletedWorkoutIds: [...deleted],
    customExercises: [...exById.values()],
  };
}

/** Normalise whatever JSON came back from the cloud into a complete CloudData object. */
export function normaliseRemote(raw: any, fallbackProfile: Profile): CloudData {
  return {
    profile: raw?.profile ?? fallbackProfile,
    profileUpdatedAt: typeof raw?.profileUpdatedAt === 'number' ? raw.profileUpdatedAt : 0,
    workouts: Array.isArray(raw?.workouts) ? raw.workouts.map(uuidifyWorkout) : [],
    deletedWorkoutIds: Array.isArray(raw?.deletedWorkoutIds) ? raw.deletedWorkoutIds.map(toUuid) : [],
    customExercises: Array.isArray(raw?.customExercises) ? raw.customExercises : [],
  };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A custom exercise row as returned by sync_pull (lower-case muscle ids) -> the app's Exercise shape. */
export function exerciseFromCloud(r: any): Exercise {
  return {
    id: String(r.id),
    name: String(r.name),
    muscle: cap(String(r.muscle)) as Muscle,
    secondary: (Array.isArray(r.secondary) ? r.secondary : []).map((m: string) => cap(m)) as Muscle[],
    equipment: (r.equipment ?? 'Other') as Exercise['equipment'],
    category: (r.category ?? 'Push') as Exercise['category'],
    difficulty: (r.difficulty ?? 'Beginner') as Exercise['difficulty'],
    tracking: (r.tracking ?? 'weighted') as Exercise['tracking'],
    instructions: r.instructions || 'Custom exercise.',
    ranked: false,
  };
}

/** What sync_pull returns. */
export interface Pull {
  workouts: Workout[];
  exercises: any[];
  deleted: string[];
}

export interface SyncPlan {
  merged: CloudData;
  pushExercises: Exercise[];
  pushWorkouts: Workout[];
  deleteIds: string[];
}

/**
 * Decide what a relational sync has to do, without touching the network.
 * `legacy` is the old single-JSON-blob copy (may be null); its workouts are migrated, not lost.
 */
export function planSync(local: CloudData, pull: Pull, legacyIn: CloudData | null): SyncPlan {
  const legacy: CloudData | null = legacyIn && {
    ...legacyIn,
    workouts: legacyIn.workouts.map(uuidifyWorkout),
    deletedWorkoutIds: legacyIn.deletedWorkoutIds.map(toUuid),
  };
  const fromPull: CloudData = {
    profile: local.profile,
    profileUpdatedAt: 0,
    workouts: pull.workouts.map(uuidifyWorkout),
    deletedWorkoutIds: pull.deleted.map(toUuid),
    customExercises: pull.exercises.map(exerciseFromCloud),
  };
  const remote = legacy ? mergeData(fromPull, legacy) : fromPull;
  // the profile only ever lives in the blob, so the pull must not win the profile comparison
  const merged = mergeData(local, { ...remote, profile: legacy?.profile ?? local.profile, profileUpdatedAt: legacy?.profileUpdatedAt ?? 0 });

  const cloudW = new Set(fromPull.workouts.map((w) => w.id));
  const cloudE = new Set(fromPull.customExercises.map((e) => e.id));
  const cloudD = new Set(fromPull.deletedWorkoutIds);
  return {
    merged,
    pushExercises: merged.customExercises.filter((e) => !cloudE.has(e.id)),
    pushWorkouts: merged.workouts.filter((w) => !cloudW.has(w.id) && w.finishedAt != null && UUID_RE.test(w.id)),
    deleteIds: merged.deletedWorkoutIds.filter((id) => !cloudD.has(id) && UUID_RE.test(id)),
  };
}
