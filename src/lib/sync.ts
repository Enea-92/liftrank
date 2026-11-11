import { AppState } from 'react-native';
import { create } from 'zustand';
import { supabase } from './supabase';
import { useStore } from '../store/useStore';
import { useAuth } from '../store/useAuth';
import { CloudData, Pull, mergeData, normaliseRemote, planSync } from './merge';

interface SyncStatus {
  state: 'idle' | 'syncing' | 'ok' | 'error';
  lastSynced: number | null;
  error: string | null;
}

export const useSyncStatus = create<SyncStatus>(() => ({ state: 'idle', lastSynced: null, error: null }));

const snapshot = (): CloudData => {
  const s = useStore.getState();
  return {
    profile: s.profile,
    profileUpdatedAt: s.profileUpdatedAt,
    workouts: s.workouts,
    deletedWorkoutIds: s.deletedWorkoutIds,
    customExercises: s.customExercises,
  };
};

const hash = (d: CloudData) => JSON.stringify(d);

let lastPushedHash = '';
let running = false;
let rerun = false;

function whenHydrated(): Promise<void> {
  return new Promise((resolve) => {
    if (useStore.persist.hasHydrated()) return resolve();
    const unsub = useStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

const isMissingFunction = (e: any) =>
  e?.code === 'PGRST202' || e?.code === '42883' || /could not find the function|schema cache/i.test(e?.message ?? '');

/** Run async jobs with a small amount of parallelism; returns the error messages of the jobs that failed. */
async function pool<T>(items: T[], size: number, job: (x: T) => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++];
      try {
        await job(item);
      } catch (e: any) {
        errors.push(e?.message ?? String(e));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return errors;
}

/**
 * Old single-JSON-blob sync. Used only when the project has not run supabase/04_sync.sql yet,
 * so the app keeps working with just the first schema file.
 */
async function legacySync(uid: string, local: CloudData, row: { data: any } | null) {
  const merged = row ? mergeData(local, normaliseRemote(row.data, local.profile)) : local;
  if (hash(merged) !== hash(local)) useStore.getState().applyMerged(merged);
  if (!row || hash(merged) !== hash(normaliseRemote(row.data, local.profile))) {
    const { error } = await supabase!.from('user_data').upsert({ user_id: uid, data: merged, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
}

/** Pull the cloud copy, merge it with this device, save the result locally and push what the cloud is missing. */
export async function syncNow(): Promise<void> {
  const session = useAuth.getState().session;
  if (!supabase || !session) return;
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  useSyncStatus.setState({ state: 'syncing', error: null });

  try {
    await whenHydrated();
    const uid = session.user.id;
    const store = useStore.getState();

    // A different account signed in on this device: don't leak the previous account's data into it.
    if (store.syncedUserId && store.syncedUserId !== uid) store.resetLocal();

    const local = snapshot();
    const { data: row, error: readErr } = await supabase.from('user_data').select('data').eq('user_id', uid).maybeSingle();
    if (readErr) throw readErr;

    const { data: pullData, error: pullErr } = await supabase.rpc('sync_pull');
    if (pullErr && isMissingFunction(pullErr)) {
      await legacySync(uid, local, row);
    } else {
      if (pullErr) throw pullErr;
      const pull = pullData as Pull;
      const legacy = row ? normaliseRemote(row.data, local.profile) : null;
      const plan = planSync(local, pull, legacy);
      const merged = plan.merged;
      if (hash(merged) !== hash(local)) useStore.getState().applyMerged(merged);

      // custom exercises first (workouts reference them), then workouts, then deletions
      const errors: string[] = [];
      errors.push(...(await pool(plan.pushExercises, 4, async (e) => {
        const { error } = await supabase!.rpc('sync_push_exercise', { p: e });
        if (error) throw error;
      })));
      const failedEx = errors.length > 0;
      errors.push(...(await pool(plan.pushWorkouts, 4, async (w) => {
        const { error } = await supabase!.rpc('sync_push_workout', { p: w });
        if (error) throw error;
      })));
      errors.push(...(await pool(plan.deleteIds, 4, async (id) => {
        const { error } = await supabase!.rpc('sync_delete_workout', { p_id: id });
        if (error) throw error;
      })));

      // Profile (and the old blob's data) stays in user_data. Only drop the old workouts from the blob
      // once everything reached the relational tables, so nothing can be lost.
      const blobData = errors.length === 0 && !failedEx
        ? { profile: merged.profile, profileUpdatedAt: merged.profileUpdatedAt, v: 2 }
        : { ...merged, v: 1 };
      if (JSON.stringify(blobData) !== JSON.stringify(row?.data ?? null)) {
        const { error } = await supabase.from('user_data').upsert({ user_id: uid, data: blobData, updated_at: new Date().toISOString() });
        if (error) errors.push(error.message);
      }
      if (errors.length) throw new Error(`${errors.length} item${errors.length === 1 ? '' : 's'} could not sync: ${errors[0]}`);
    }

    useStore.getState().markSynced(uid);
    lastPushedHash = hash(snapshot());
    useSyncStatus.setState({ state: 'ok', lastSynced: Date.now(), error: null });
  } catch (e: any) {
    useSyncStatus.setState({ state: 'error', error: e?.message ?? String(e) });
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      void syncNow();
    }
  }
}

let started = false;

/** Call once at app start. Syncs on sign-in, after edits (debounced) and when the app returns to the foreground. */
export function startAutoSync() {
  if (started || !supabase) return;
  started = true;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (!useAuth.getState().session) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (hash(snapshot()) !== lastPushedHash) void syncNow();
    }, 2000);
  };

  useStore.subscribe((s, prev) => {
    if (
      s.workouts !== prev.workouts ||
      s.profile !== prev.profile ||
      s.deletedWorkoutIds !== prev.deletedWorkoutIds ||
      s.customExercises !== prev.customExercises
    ) {
      schedule();
    }
  });

  let lastUid: string | null = null;
  useAuth.subscribe((a) => {
    const uid = a.session?.user.id ?? null;
    if (uid && uid !== lastUid) void syncNow();
    if (!uid) useSyncStatus.setState({ state: 'idle', error: null });
    lastUid = uid;
  });

  AppState.addEventListener('change', (st) => {
    if (st === 'active') void syncNow();
  });
}
