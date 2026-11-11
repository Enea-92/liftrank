import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, Modal, StyleSheet, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  useStore, findExercise, toDisplay, fromDisplay, lastSessionSets, rankSnapshot, SetEntry, Workout,
} from '../store/useStore';
import { TRACKING_LABELS, TrackingType } from '../data/exercises';
import { Button, Card, Dim, Stat } from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';
import { colors, radius, spacing, fmtDate, fmtDuration } from '../theme';
import { confirmAction } from '../lib/dialog';
import { fmtKg, fmtSet } from '../lib/format';
import { PREvent, personalRecords, workoutVolume } from '../lib/stats';
import { recommend } from '../lib/recommend';
import { RankUp, diffRanks } from '../lib/rankup';
import { RANKS, RANK_COLORS } from '../data/ranks';

const REST_SECONDS = 90;

function useTick(active: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

interface Summary {
  workout: Workout;
  prs: PREvent[];
  rankUps: RankUp[];
}

export default function WorkoutScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();

  const active = useStore((s) => s.active);
  const workouts = useStore((s) => s.workouts);
  const startWorkout = useStore((s) => s.startWorkout);
  const startFromWorkout = useStore((s) => s.startFromWorkout);
  const cancelWorkout = useStore((s) => s.cancelWorkout);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const setWorkoutNotes = useStore((s) => s.setWorkoutNotes);
  const addExercise = useStore((s) => s.addExercise);
  const removeExercise = useStore((s) => s.removeExercise);
  const moveExercise = useStore((s) => s.moveExercise);
  const repeatLast = useStore((s) => s.repeatLast);
  const addSet = useStore((s) => s.addSet);
  const updateSet = useStore((s) => s.updateSet);
  const removeSet = useStore((s) => s.removeSet);
  const applySuggestion = useStore((s) => s.applySuggestion);
  const goal = useStore((s) => s.profile.goal);
  const unit = useStore((s) => s.profile.unit);
  const custom = useStore((s) => s.customExercises);

  const [picker, setPicker] = useState(false);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  useTick(!!active);

  // "Log exercise" quick action on Home opens the picker straight away.
  useEffect(() => {
    if (route.params?.openPicker) {
      if (!useStore.getState().active) startWorkout();
      setPicker(true);
      nav.setParams({ openPicker: false });
    }
  }, [route.params?.openPicker]);

  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - Date.now()) / 1000)) : 0;

  const finish = () => {
    if (!active) return;
    const id = active.id;
    const before = useStore.getState();
    const rankBefore = rankSnapshot(before.workouts, before.profile, before.customExercises);
    finishWorkout();
    setRestEnd(null);
    const after = useStore.getState();
    const saved = after.workouts.find((w) => w.id === id);
    if (saved) {
      const prs = personalRecords(after.workouts).filter((p) => p.workoutId === id);
      const rankUps = diffRanks(rankBefore, rankSnapshot(after.workouts, after.profile, after.customExercises));
      setSummary({ workout: saved, prs, rankUps });
    }
  };

  const confirmFinish = () => {
    if (!active) return;
    const doneSets = active.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
    if (doneSets === 0) {
      confirmAction({
        title: 'No sets completed',
        message: 'Tick at least one set to save the workout, or discard it.',
        confirmLabel: 'Discard workout',
        destructive: true,
        onConfirm: cancelWorkout,
      });
      return;
    }
    finish();
  };

  const toggleDone = (weId: string, s: SetEntry) => {
    updateSet(weId, s.id, { done: !s.done });
    if (!s.done) setRestEnd(Date.now() + REST_SECONDS * 1000);
  };

  const summaryModal = (
    <SummaryModal summary={summary} unit={unit} custom={custom} onClose={() => setSummary(null)} />
  );

  // ------------------------------------------------ not started
  if (!active) {
    const last = workouts[0];
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <Text style={styles.big}>Workout</Text>
          <Dim style={{ marginBottom: spacing.lg }}>Log sets fast, with your last numbers ready to repeat.</Dim>
          <Button title="Start empty workout" onPress={() => startWorkout()} />
          {last && (
            <Button
              title={`Repeat last: ${last.name}`}
              variant="ghost"
              onPress={() => startFromWorkout(last.id)}
              style={{ marginTop: spacing.sm }}
            />
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Recent workouts</Text>
            {workouts.length > 0 && (
              <Text onPress={() => nav.navigate('History')} style={{ color: colors.accent, fontWeight: '700' }}>
                See all
              </Text>
            )}
          </View>
          {workouts.length === 0 ? (
            <Card>
              <Dim>No workouts yet. Your finished workouts appear here.</Dim>
            </Card>
          ) : (
            workouts.slice(0, 3).map((w) => (
              <Card key={w.id} style={{ marginBottom: spacing.sm }}>
                <View style={styles.rowBetween}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{w.name}</Text>
                  <Dim>{fmtDate(w.startedAt)}</Dim>
                </View>
                <Dim style={{ marginTop: 2 }}>
                  {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'} · {fmtKg(workoutVolume(w), unit)} volume
                </Dim>
                <Text onPress={() => startFromWorkout(w.id)} style={{ color: colors.accent, fontWeight: '700', marginTop: 8 }}>
                  Repeat this workout
                </Text>
              </Card>
            ))
          )}
        </ScrollView>
        {summaryModal}
      </SafeAreaView>
    );
  }

  // ------------------------------------------------ in progress
  const elapsed = Date.now() - active.startedAt;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{active.name}</Text>
            <Dim>{fmtDuration(elapsed)}</Dim>
          </View>
          <Button title="Finish" onPress={confirmFinish} style={{ paddingVertical: 9 }} />
        </View>

        {restEnd && restLeft > 0 && (
          <View style={styles.rest}>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>
              Rest {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
            </Text>
            <Pressable onPress={() => setRestEnd(null)}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Skip</Text>
            </Pressable>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {active.exercises.length === 0 && (
            <Dim style={{ textAlign: 'center', marginVertical: 32 }}>Add your first exercise to begin.</Dim>
          )}

          {active.exercises.map((we, idx) => {
            const ex = findExercise(we.exerciseId, custom);
            const tracking: TrackingType = ex?.tracking ?? 'weighted';
            const lastSets = lastSessionSets(workouts, we.exerciseId);
            const rec = ex && we.sets.some((x) => !x.done) ? recommend(workouts, ex, unit, goal) : null;
            return (
              <Card key={we.id} style={{ marginBottom: spacing.md }}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{ex?.name ?? 'Exercise'}</Text>
                    <Dim>{ex?.muscle}</Dim>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                    <Pressable onPress={() => moveExercise(we.id, -1)} hitSlop={8} disabled={idx === 0}>
                      <Text style={{ color: idx === 0 ? colors.border : colors.textDim, fontSize: 18 }}>▲</Text>
                    </Pressable>
                    <Pressable onPress={() => moveExercise(we.id, 1)} hitSlop={8} disabled={idx === active.exercises.length - 1}>
                      <Text style={{ color: idx === active.exercises.length - 1 ? colors.border : colors.textDim, fontSize: 18 }}>▼</Text>
                    </Pressable>
                    <Pressable onPress={() => removeExercise(we.id)} hitSlop={10}>
                      <Text style={{ color: colors.danger }}>Remove</Text>
                    </Pressable>
                  </View>
                </View>

                {lastSets.length > 0 && (
                  <View style={styles.prev}>
                    <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: '700' }}>LAST TIME</Text>
                    <Text style={{ color: colors.text, marginTop: 2 }}>
                      {lastSets.slice(0, 5).map((s) => fmtSet(s, tracking, unit)).join('   ')}
                      {lastSets.length > 5 ? `   +${lastSets.length - 5} more` : ''}
                    </Text>
                    <Text onPress={() => repeatLast(we.id)} style={{ color: colors.accent, fontWeight: '700', marginTop: 6 }}>
                      Repeat last session
                    </Text>
                  </View>
                )}

                {rec && (
                  <View style={[styles.prev, { backgroundColor: colors.accentDim, marginTop: spacing.sm }]}>
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>
                      {rec.kind === 'deload' ? 'SUGGESTED LIGHTER SESSION' : 'SUGGESTED TODAY'}
                    </Text>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 2 }}>
                      {fmtSet(rec, tracking, unit)}  ·  {rec.sets} set{rec.sets === 1 ? '' : 's'}
                    </Text>
                    <Text style={{ color: colors.textDim, marginTop: 2, lineHeight: 18 }}>{rec.reason}</Text>
                    <Text
                      onPress={() => applySuggestion(we.id, rec.weightKg, rec.reps, rec.sets)}
                      style={{ color: colors.accent, fontWeight: '800', marginTop: 8 }}
                    >
                      Use this suggestion
                    </Text>
                  </View>
                )}

                <View style={[styles.setRow, { marginTop: spacing.md }]}>
                  <Text style={[styles.colHead, { width: 28 }]}>SET</Text>
                  {TRACKING_LABELS[tracking].showA && (
                    <Text style={[styles.colHead, { flex: 1 }]}>{TRACKING_LABELS[tracking].a.replace('KG', unit.toUpperCase())}</Text>
                  )}
                  <Text style={[styles.colHead, { flex: 1 }]}>{TRACKING_LABELS[tracking].b}</Text>
                  <Text style={[styles.colHead, { width: 44, textAlign: 'center' }]}>DONE</Text>
                </View>

                {we.sets.map((s, i) => (
                  <SetRow
                    key={s.id}
                    index={i}
                    set={s}
                    unit={unit}
                    tracking={tracking}
                    onChange={(patch) => updateSet(we.id, s.id, patch)}
                    onToggle={() => toggleDone(we.id, s)}
                    onRemove={() => removeSet(we.id, s.id)}
                  />
                ))}

                <Button title="+ Add set" variant="ghost" onPress={() => addSet(we.id)} style={{ marginTop: spacing.sm, paddingVertical: 9 }} />
              </Card>
            );
          })}

          <Button title="+ Add exercise" onPress={() => setPicker(true)} />

          <Text style={{ color: colors.textDim, fontSize: 13, marginTop: spacing.xl, marginBottom: 6 }}>Workout notes</Text>
          <TextInput
            style={[styles.input, { textAlign: 'left', minHeight: 70, textAlignVertical: 'top' }]}
            multiline
            placeholder="How did it feel? Anything to remember next time?"
            placeholderTextColor={colors.textDim}
            value={active.notes ?? ''}
            onChangeText={setWorkoutNotes}
            maxLength={2000}
          />

          <Button
            title="Discard workout"
            variant="danger"
            onPress={() =>
              confirmAction({
                title: 'Discard workout?',
                message: 'This cannot be undone.',
                confirmLabel: 'Discard',
                destructive: true,
                onConfirm: () => {
                  cancelWorkout();
                  setRestEnd(null);
                },
              })
            }
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(id) => {
          addExercise(id);
          setPicker(false);
        }}
      />
      {summaryModal}
    </SafeAreaView>
  );
}

function SetRow({
  index, set, unit, tracking, onChange, onToggle, onRemove,
}: {
  index: number;
  set: SetEntry;
  unit: 'kg' | 'lb';
  tracking: TrackingType;
  onChange: (p: Partial<SetEntry>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const showWeight = TRACKING_LABELS[tracking].showA;
  const [w, setW] = useState(set.weightKg ? String(toDisplay(set.weightKg, unit)) : '');
  const [r, setR] = useState(String(set.reps || ''));

  // Values can change from outside (a suggestion, "Repeat last session"), so follow the store.
  // Text the user is typing is left alone as long as it already means the same number ("80." stays "80.").
  useEffect(() => {
    const typedW = parseFloat(w.replace(',', '.'));
    const storeW = set.weightKg ? toDisplay(set.weightKg, unit) : 0;
    if (Math.abs((isNaN(typedW) ? 0 : typedW) - storeW) > 0.06) setW(set.weightKg ? String(storeW) : '');
    const typedR = parseInt(r, 10);
    if ((isNaN(typedR) ? 0 : typedR) !== set.reps) setR(String(set.reps || ''));
  }, [set.id, set.weightKg, set.reps, unit]);

  return (
    <Pressable onLongPress={onRemove} style={[styles.setRow, set.done && { opacity: 0.55 }]}>
      <Pressable onPress={onRemove} hitSlop={8} style={{ width: 28 }}>
        <Text style={styles.setNum}>{index + 1}</Text>
      </Pressable>
      {showWeight && (
        <TextInput
          style={[styles.input, { flex: 1 }]}
          keyboardType="decimal-pad"
          value={w}
          placeholder="0"
          placeholderTextColor={colors.textDim}
          selectTextOnFocus
          onChangeText={(t) => {
            setW(t);
            const n = parseFloat(t.replace(',', '.'));
            onChange({ weightKg: isNaN(n) || n < 0 ? 0 : fromDisplay(n, unit) });
          }}
        />
      )}
      <TextInput
        style={[styles.input, { flex: 1 }]}
        keyboardType="number-pad"
        value={r}
        placeholder="0"
        placeholderTextColor={colors.textDim}
        selectTextOnFocus
        onChangeText={(t) => {
          setR(t);
          const n = parseInt(t, 10);
          onChange({ reps: isNaN(n) || n < 0 ? 0 : n });
        }}
      />
      <Pressable onPress={onToggle} style={[styles.check, set.done && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        <Text style={{ color: set.done ? colors.onAccent : colors.textDim, fontWeight: '800', fontSize: 16 }}>✓</Text>
      </Pressable>
    </Pressable>
  );
}

function SummaryModal({
  summary, unit, custom, onClose,
}: {
  summary: Summary | null;
  unit: 'kg' | 'lb';
  custom: ReturnType<typeof useStore.getState>['customExercises'];
  onClose: () => void;
}) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!summary) return;
    scale.setValue(0.4);
    glow.setValue(0);
    slide.setValue(0);
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    if (summary.rankUps.length === 0) return;
    // rank-up: the badge slides in, then pulses a few times
    Animated.sequence([
      Animated.delay(350),
      Animated.timing(slide, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        ]),
        { iterations: 3 },
      ),
    ]).start();
  }, [summary]);
  if (!summary) return null;

  const w = summary.workout;
  const sets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const dur = w.finishedAt ? w.finishedAt - w.startedAt : 0;
  // one line per exercise: show the 1RM improvement if there is one, otherwise the weight improvement
  const lines = new Map<string, PREvent>();
  for (const p of summary.prs) {
    const cur = lines.get(p.exerciseId);
    if (!cur || p.type === 'est_1rm') lines.set(p.exerciseId, p);
  }

  const overallUp = summary.rankUps.find((r) => r.scope === 'overall');
  const shownUps = summary.rankUps.slice(0, 4);
  const label = (r: RankUp) => (r.scope === 'overall' ? 'Overall strength' : r.scope === 'muscle' ? r.key : findExercise(r.key, custom)?.name ?? r.key);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <ScrollView style={[styles.modalCard, { flexGrow: 0 }]} showsVerticalScrollIndicator={false}>
          <Animated.Text style={{ fontSize: 44, textAlign: 'center', transform: [{ scale }] }}>
            {overallUp ? '🚀' : summary.rankUps.length > 0 ? '⬆️' : summary.prs.length > 0 ? '🏆' : '✅'}
          </Animated.Text>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 4 }}>
            {overallUp ? 'Rank up!' : summary.rankUps.length > 0 ? 'Stronger ranks!' : summary.prs.length > 0 ? 'New personal record!' : 'Workout complete'}
          </Text>
          <Dim style={{ textAlign: 'center', marginBottom: spacing.lg }}>{w.name}</Dim>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Stat label="Time" value={dur ? fmtDuration(dur) : '-'} />
            <Stat label="Volume" value={fmtKg(workoutVolume(w), unit)} />
            <Stat label="Sets" value={String(sets)} />
          </View>

          {[...lines.values()].map((p) => {
            const ex = findExercise(p.exerciseId, custom);
            const pct = p.previous > 0 ? ((p.value - p.previous) / p.previous) * 100 : 0;
            return (
              <View key={p.exerciseId} style={styles.prRow}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{ex?.name}</Text>
                <Text style={{ color: colors.textDim, marginTop: 2 }}>
                  {p.type === 'est_1rm' ? 'Estimated 1RM' : 'Heaviest weight'}: {fmtKg(p.previous, unit)} → {fmtKg(p.value, unit)}
                </Text>
                <Text style={{ color: colors.accent, fontWeight: '800', marginTop: 2 }}>+{pct.toFixed(1)}%</Text>
              </View>
            );
          })}

          {shownUps.length > 0 && (
            <Animated.View
              style={{
                marginTop: spacing.lg,
                opacity: slide,
                transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
              }}
            >
              {shownUps.map((r, i) => {
                const c = RANK_COLORS[RANKS[r.to]];
                return (
                  <Animated.View
                    key={r.scope + r.key}
                    style={[styles.prRow, { borderWidth: 1, borderColor: c, opacity: i === 0 ? glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) : 1 }]}
                  >
                    <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: '800' }}>
                      {r.scope === 'overall' ? 'OVERALL RANK UP' : r.scope === 'muscle' ? 'MUSCLE RANK UP' : 'LIFT RANK UP'}
                    </Text>
                    <Text style={{ color: colors.text, fontWeight: '800', marginTop: 2 }}>{label(r)}</Text>
                    <Text style={{ marginTop: 2, fontWeight: '900', fontSize: 16 }}>
                      <Text style={{ color: RANK_COLORS[RANKS[r.from]] }}>{RANKS[r.from]}</Text>
                      <Text style={{ color: colors.textDim }}>  →  </Text>
                      <Text style={{ color: c }}>{RANKS[r.to]}</Text>
                    </Text>
                  </Animated.View>
                );
              })}
              {summary.rankUps.length > shownUps.length && (
                <Dim style={{ textAlign: 'center', marginTop: 8 }}>+{summary.rankUps.length - shownUps.length} more in Rankings</Dim>
              )}
            </Animated.View>
          )}

          <Button title="Done" onPress={onClose} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  big: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  rest: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.accentDim },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  prev: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.md },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  colHead: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  setNum: { color: colors.textDim, fontWeight: '700' },
  input: {
    backgroundColor: colors.cardAlt, color: colors.text, borderRadius: radius.sm,
    paddingVertical: 11, paddingHorizontal: 10, fontSize: 18, fontWeight: '700', textAlign: 'center',
  },
  check: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, maxHeight: '90%' },
  prRow: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
});
