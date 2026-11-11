import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXERCISES, Exercise, MUSCLES, Muscle, TrackingType, exerciseById } from '../data/exercises';
import { Sex, estimate1RM, rankFor, rankFromScore, RankResult } from '../data/ranks';
import type { CloudData } from '../lib/merge';
import type { RankSnapshot } from '../lib/rankup';
import { toUuid, uuid, uuidifyWorkout } from '../lib/uuid';

export type Unit = 'kg' | 'lb';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'build_muscle' | 'increase_strength' | 'lose_fat' | 'improve_fitness' | 'general_health';

export interface SetEntry {
  id: string;
  /** weight (or added / assistance weight) in kg */
  weightKg: number;
  /** reps, or seconds for timed exercises, or minutes for cardio */
  reps: number;
  done: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
  notes?: string;
}

export interface Workout {
  id: string;
  startedAt: number;
  finishedAt?: number;
  name: string;
  notes?: string;
  exercises: WorkoutExercise[];
}

export interface Profile {
  unit: Unit;
  /** Which strength standards to use for ranks. */
  sex: Sex;
  bodyweightKg: number;
  name: string;
  username: string;
  gender: Gender | null;
  /** ISO date YYYY-MM-DD */
  dob: string | null;
  heightCm: number | null;
  country: string;
  experience: Experience | null;
  goal: Goal | null;
  sessionsPerWeek: number;
  /** 0 = Sunday .. 6 = Saturday */
  trainingDays: number[];
  durationMin: number;
  equipment: string[];
  preferredExercises: string[];
  onboarded: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  unit: 'kg',
  sex: 'male',
  bodyweightKg: 75,
  name: '',
  username: '',
  gender: null,
  dob: null,
  heightCm: null,
  country: '',
  experience: null,
  goal: null,
  sessionsPerWeek: 3,
  trainingDays: [1, 3, 5],
  durationMin: 60,
  equipment: [],
  preferredExercises: [],
  onboarded: false,
};

interface State {
  profile: Profile;
  workouts: Workout[]; // finished
  active: Workout | null;
  customExercises: Exercise[];
  /** Local-only (not synced): profile picture URI. */
  avatarUri: string | null;
  /** Cloud-sync bookkeeping */
  profileUpdatedAt: number;
  deletedWorkoutIds: string[];
  syncedUserId: string | null;

  applyMerged: (d: CloudData) => void;
  markSynced: (userId: string) => void;
  resetLocal: () => void;
  setProfile: (p: Partial<Profile>) => void;
  setAvatar: (uri: string | null) => void;
  startWorkout: (name?: string) => void;
  startFromWorkout: (id: string) => void;
  cancelWorkout: () => void;
  finishWorkout: () => void;
  setWorkoutNotes: (notes: string) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (weId: string) => void;
  moveExercise: (weId: string, dir: -1 | 1) => void;
  repeatLast: (weId: string) => void;
  addSet: (weId: string) => void;
  updateSet: (weId: string, setId: string, patch: Partial<SetEntry>) => void;
  removeSet: (weId: string, setId: string) => void;
  applySuggestion: (weId: string, weightKg: number, reps: number, sets: number) => void;
  deleteWorkout: (id: string) => void;
  addCustomExercise: (name: string, muscle: Muscle, tracking: TrackingType) => string;
  exportJson: () => string;
}

const uid = () => uuid();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      workouts: [],
      active: null,
      customExercises: [],
      avatarUri: null,
      profileUpdatedAt: 0,
      deletedWorkoutIds: [],
      syncedUserId: null,

      applyMerged: (d) =>
        set({
          profile: { ...DEFAULT_PROFILE, ...d.profile },
          profileUpdatedAt: d.profileUpdatedAt,
          workouts: d.workouts,
          deletedWorkoutIds: d.deletedWorkoutIds,
          customExercises: d.customExercises,
        }),

      markSynced: (userId) => set({ syncedUserId: userId }),

      resetLocal: () =>
        set({
          profile: DEFAULT_PROFILE,
          profileUpdatedAt: 0,
          workouts: [],
          deletedWorkoutIds: [],
          customExercises: [],
          active: null,
          avatarUri: null,
          syncedUserId: null,
        }),

      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p }, profileUpdatedAt: Date.now() })),

      setAvatar: (uri) => set({ avatarUri: uri }),

      startWorkout: (name) =>
        set((s) => {
          if (s.active) return s;
          const d = new Date();
          return {
            active: {
              id: uid(),
              startedAt: d.getTime(),
              name: name ?? `Workout ${d.toLocaleDateString()}`,
              exercises: [],
            },
          };
        }),

      /** Start a new workout that repeats the exercises and sets of a finished one (sets start unticked). */
      startFromWorkout: (id) =>
        set((s) => {
          if (s.active) return s;
          const w = s.workouts.find((x) => x.id === id);
          if (!w) return s;
          return {
            active: {
              id: uid(),
              startedAt: Date.now(),
              name: w.name,
              exercises: w.exercises.map((e) => ({
                id: uid(),
                exerciseId: e.exerciseId,
                sets: e.sets.map((x) => ({ id: uid(), weightKg: x.weightKg, reps: x.reps, done: false })),
              })),
            },
          };
        }),

      cancelWorkout: () => set({ active: null }),

      finishWorkout: () =>
        set((s) => {
          if (!s.active) return s;
          // drop empty / not-done sets and empty exercises
          const exercises = s.active.exercises
            .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done && x.reps > 0) }))
            .filter((e) => e.sets.length > 0);
          if (exercises.length === 0) return { active: null };
          return {
            workouts: [{ ...s.active, exercises, finishedAt: Date.now() }, ...s.workouts],
            active: null,
          };
        }),

      setWorkoutNotes: (notes) => set((s) => (s.active ? { active: { ...s.active, notes } } : s)),

      addExercise: (exerciseId) =>
        set((s) => {
          if (!s.active) return s;
          // Pre-fill first set from the last time this exercise was done.
          const last = lastSetFor(s.workouts, exerciseId);
          const first: SetEntry = {
            id: uid(),
            weightKg: last?.weightKg ?? 0,
            reps: last?.reps ?? 8,
            done: false,
          };
          return {
            active: {
              ...s.active,
              exercises: [...s.active.exercises, { id: uid(), exerciseId, sets: [first] }],
            },
          };
        }),

      removeExercise: (weId) =>
        set((s) =>
          s.active
            ? { active: { ...s.active, exercises: s.active.exercises.filter((e) => e.id !== weId) } }
            : s,
        ),

      moveExercise: (weId, dir) =>
        set((s) => {
          if (!s.active) return s;
          const list = [...s.active.exercises];
          const i = list.findIndex((e) => e.id === weId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return s;
          [list[i], list[j]] = [list[j], list[i]];
          return { active: { ...s.active, exercises: list } };
        }),

      /** Replace this exercise's sets with the sets from the last finished session (all marked not done). */
      repeatLast: (weId) =>
        set((s) => {
          if (!s.active) return s;
          const we = s.active.exercises.find((e) => e.id === weId);
          if (!we) return s;
          const prev = lastSessionSets(s.workouts, we.exerciseId);
          if (!prev.length) return s;
          const sets: SetEntry[] = prev.map((p) => ({ id: uid(), weightKg: p.weightKg, reps: p.reps, done: false }));
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((e) => (e.id === weId ? { ...e, sets } : e)),
            },
          };
        }),

      addSet: (weId) =>
        set((s) => {
          if (!s.active) return s;
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((e) => {
                if (e.id !== weId) return e;
                const prev = e.sets[e.sets.length - 1];
                return {
                  ...e,
                  sets: [
                    ...e.sets,
                    { id: uid(), weightKg: prev?.weightKg ?? 0, reps: prev?.reps ?? 8, done: false },
                  ],
                };
              }),
            },
          };
        }),

      updateSet: (weId, setId, patch) =>
        set((s) =>
          s.active
            ? {
                active: {
                  ...s.active,
                  exercises: s.active.exercises.map((e) =>
                    e.id !== weId
                      ? e
                      : { ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch } : x)) },
                  ),
                },
              }
            : s,
        ),

      // Fill the exercise's unfinished sets with a suggestion, adding sets up to the suggested count.
      applySuggestion: (weId, weightKg, reps, sets) =>
        set((s) => {
          if (!s.active) return s;
          return {
            active: {
              ...s.active,
              exercises: s.active.exercises.map((e) => {
                if (e.id !== weId) return e;
                const filled = e.sets.map((x) => (x.done ? x : { ...x, weightKg, reps }));
                while (filled.length < sets) filled.push({ id: uid(), weightKg, reps, done: false });
                return { ...e, sets: filled };
              }),
            },
          };
        }),

      removeSet: (weId, setId) =>
        set((s) =>
          s.active
            ? {
                active: {
                  ...s.active,
                  exercises: s.active.exercises.map((e) =>
                    e.id !== weId ? e : { ...e, sets: e.sets.filter((x) => x.id !== setId) },
                  ),
                },
              }
            : s,
        ),

      deleteWorkout: (id) =>
        set((s) => ({
          workouts: s.workouts.filter((w) => w.id !== id),
          // Remember the deletion so other devices don't bring the workout back when syncing.
          deletedWorkoutIds: s.deletedWorkoutIds.includes(id) ? s.deletedWorkoutIds : [...s.deletedWorkoutIds, id],
        })),

      addCustomExercise: (name, muscle, tracking) => {
        const id = 'custom-' + uuid();
        set((s) => ({
          customExercises: [
            ...s.customExercises,
            {
              id,
              name: name.trim(),
              muscle,
              secondary: [],
              equipment: 'Other',
              category: 'Push',
              difficulty: 'Beginner',
              tracking,
              instructions: 'Custom exercise.',
              ranked: false,
            },
          ],
        }));
        return id;
      },

      exportJson: () =>
        JSON.stringify(
          { exportedAt: new Date().toISOString(), profile: get().profile, workouts: get().workouts },
          null,
          2,
        ),
    }),
    {
      name: 'liftrank-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        profile: s.profile,
        workouts: s.workouts,
        active: s.active,
        customExercises: s.customExercises,
        avatarUri: s.avatarUri,
        profileUpdatedAt: s.profileUpdatedAt,
        deletedWorkoutIds: s.deletedWorkoutIds,
        syncedUserId: s.syncedUserId,
      }),
      // Older saved data has a smaller profile and custom exercises without the new fields.
      merge: (persisted: any, current) => {
        const p = persisted ?? {};
        return {
          ...current,
          ...p,
          profile: { ...DEFAULT_PROFILE, ...(p.profile ?? {}) },
          // ids from older versions of the app were short random strings; the database needs UUIDs
          workouts: (p.workouts ?? []).map(uuidifyWorkout),
          active: p.active ? uuidifyWorkout(p.active) : null,
          deletedWorkoutIds: (p.deletedWorkoutIds ?? []).map(toUuid),
          customExercises: (p.customExercises ?? []).map((e: any) => ({
            secondary: [],
            equipment: 'Other',
            category: 'Push',
            difficulty: 'Beginner',
            tracking: 'weighted',
            instructions: 'Custom exercise.',
            ...e,
          })),
        };
      },
    },
  ),
);

// ---------- selectors / helpers ----------

export function allExercises(custom: Exercise[]): Exercise[] {
  return [...EXERCISES, ...custom];
}

export function findExercise(id: string, custom: Exercise[]): Exercise | undefined {
  return exerciseById(id) ?? custom.find((e) => e.id === id);
}

export function lastSetFor(workouts: Workout[], exerciseId: string): SetEntry | undefined {
  for (const w of workouts) {
    const we = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (we && we.sets.length) return we.sets[we.sets.length - 1];
  }
  return undefined;
}

/** All sets of the most recent finished session of this exercise. */
export function lastSessionSets(workouts: Workout[], exerciseId: string): SetEntry[] {
  for (const w of workouts) {
    const we = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (we && we.sets.length) return we.sets;
  }
  return [];
}

export interface ExercisePoint {
  date: number;
  best1RM: number;
  volume: number;
  topWeight: number;
}

/** Chronological (oldest -> newest) per-session stats for one exercise. */
export function historyFor(workouts: Workout[], exerciseId: string): ExercisePoint[] {
  const pts: ExercisePoint[] = [];
  for (const w of workouts) {
    const we = w.exercises.filter((e) => e.exerciseId === exerciseId);
    if (!we.length) continue;
    let best = 0;
    let vol = 0;
    let top = 0;
    for (const e of we)
      for (const s of e.sets) {
        best = Math.max(best, estimate1RM(s.weightKg, s.reps));
        vol += s.weightKg * s.reps;
        top = Math.max(top, s.weightKg);
      }
    pts.push({ date: w.finishedAt ?? w.startedAt, best1RM: best, volume: vol, topWeight: top });
  }
  return pts.sort((a, b) => a.date - b.date);
}

export function best1RMFor(workouts: Workout[], exerciseId: string): number {
  return historyFor(workouts, exerciseId).reduce((m, p) => Math.max(m, p.best1RM), 0);
}

export interface ExerciseRank {
  exercise: Exercise;
  oneRepMax: number;
  result: RankResult;
}

/** Rank levels right now: overall, per muscle, per ranked lift. Used to detect rank-ups. */
export function rankSnapshot(workouts: Workout[], profile: Profile, custom: Exercise[]): RankSnapshot {
  const ranks = computeRanks(workouts, profile, custom);
  const muscles = muscleSummaries(ranks);
  const overall = overallRank(muscles);
  return {
    overall: overall ? overall.rank.rankIndex : null,
    muscles: Object.fromEntries(muscles.map((m) => [m.muscle, m.rank ? m.rank.rankIndex : null])),
    lifts: Object.fromEntries(ranks.map((r) => [r.exercise.id, r.result.rankIndex])),
  };
}

export function computeRanks(workouts: Workout[], profile: Profile, custom: Exercise[]): ExerciseRank[] {
  const out: ExerciseRank[] = [];
  for (const ex of allExercises(custom)) {
    if (!ex.ranked) continue;
    const orm = best1RMFor(workouts, ex.id);
    if (orm <= 0) continue;
    const r = rankFor(ex.id, orm, profile.bodyweightKg, profile.sex);
    if (r) out.push({ exercise: ex, oneRepMax: orm, result: r });
  }
  return out;
}

export interface MuscleSummary {
  muscle: Muscle;
  score: number | null; // 0..6, null = no ranked lifts logged
  rank: ReturnType<typeof rankFromScore> | null;
}

export function muscleSummaries(ranks: ExerciseRank[]): MuscleSummary[] {
  return MUSCLES.map((m) => {
    const rs = ranks.filter((r) => r.exercise.muscle === m);
    if (!rs.length) return { muscle: m, score: null, rank: null };
    const score = rs.reduce((a, r) => a + r.result.score, 0) / rs.length;
    return { muscle: m, score, rank: rankFromScore(score) };
  });
}

export function overallRank(summaries: MuscleSummary[]): { score: number; rank: ReturnType<typeof rankFromScore> } | null {
  const scored = summaries.filter((s) => s.score !== null) as (MuscleSummary & { score: number })[];
  if (!scored.length) return null;
  const score = scored.reduce((a, s) => a + s.score, 0) / scored.length;
  return { score, rank: rankFromScore(score) };
}

// ---------- unit helpers ----------
export const KG_PER_LB = 0.45359237;
export const toDisplay = (kg: number, unit: Unit) =>
  unit === 'kg' ? Math.round(kg * 10) / 10 : Math.round((kg / KG_PER_LB) * 10) / 10;
export const fromDisplay = (v: number, unit: Unit) => (unit === 'kg' ? v : v * KG_PER_LB);
