import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button, Card, Chip, ChipRow, Dim, SectionTitle, Stat } from '../components/ui';
import LineChart from '../components/LineChart';
import { colors, spacing } from '../theme';
import { findExercise, historyFor, lastSessionSets, toDisplay, useStore } from '../store/useStore';
import { PERIODS, Period, periodCutoff } from '../lib/stats';
import { fmtSet } from '../lib/format';
import { recommend } from '../lib/recommend';

type Metric = 'best1RM' | 'topWeight' | 'volume';

export default function ExerciseDetailScreen() {
  const nav = useNavigation<any>();
  const { id } = useRoute<any>().params as { id: string };
  const { width } = useWindowDimensions();

  const custom = useStore((s) => s.customExercises);
  const workouts = useStore((s) => s.workouts);
  const active = useStore((s) => s.active);
  const unit = useStore((s) => s.profile.unit);
  const goal = useStore((s) => s.profile.goal);
  const startWorkout = useStore((s) => s.startWorkout);
  const addExercise = useStore((s) => s.addExercise);

  const ex = findExercise(id, custom);
  const [period, setPeriod] = useState<Period>('90d');
  const [metric, setMetric] = useState<Metric>('best1RM');

  const all = useMemo(() => historyFor(workouts, id), [workouts, id]);
  const stats = useMemo(() => {
    let sets = 0, reps = 0, volume = 0;
    for (const w of workouts)
      for (const e of w.exercises)
        if (e.exerciseId === id)
          for (const s of e.sets) {
            sets++;
            reps += s.reps;
            volume += s.weightKg * s.reps;
          }
    return { sets, reps, volume, best1RM: all.reduce((m, p) => Math.max(m, p.best1RM), 0) };
  }, [workouts, id, all]);

  if (!ex) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Dim>This exercise no longer exists.</Dim>
      </SafeAreaView>
    );
  }

  const weighted = ex.tracking === 'weighted' || ex.tracking === 'bodyweight';
  const cutoff = periodCutoff(period, Date.now());
  const pts = all.filter((p) => p.date >= cutoff);
  const values = pts.map((p) => toDisplay(p[metric], unit));
  const labels = pts.map((p) => new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const first = values[0];
  const last = values[values.length - 1];
  const change = values.length > 1 && first > 0 ? ((last - first) / first) * 100 : null;
  const prev = lastSessionSets(workouts, id);
  const rec = recommend(workouts, ex, unit, goal);

  const addToWorkout = () => {
    if (!active) startWorkout();
    addExercise(id);
    nav.navigate('Main', { screen: 'Workout' });
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>{ex.name}</Text>
        <View style={{ marginTop: spacing.md }}>
          <ChipRow>
            <Chip label={ex.muscle} active />
            <Chip label={ex.equipment} />
            <Chip label={ex.difficulty} />
            <Chip label={ex.category} />
          </ChipRow>
        </View>
        {ex.secondary.length > 0 && (
          <Dim style={{ marginTop: 10 }}>Also works: {ex.secondary.join(', ')}</Dim>
        )}

        <Button title={active ? 'Add to current workout' : 'Start workout with this exercise'} onPress={addToWorkout} style={{ marginTop: spacing.lg }} />

        <SectionTitle>How to do it</SectionTitle>
        <Card>
          <Text style={{ color: colors.text, lineHeight: 22 }}>{ex.instructions}</Text>
        </Card>

        <SectionTitle>Your numbers</SectionTitle>
        {all.length === 0 ? (
          <Card>
            <Dim>You have not logged this exercise yet. Once you do, your progress shows up here.</Dim>
          </Card>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {ex.tracking === 'weighted' && <Stat label="Best est. 1RM" value={`${Math.round(toDisplay(stats.best1RM, unit))} ${unit}`} />}
              <Stat label="Total sets" value={String(stats.sets)} />
              <Stat label="Total reps" value={String(stats.reps)} />
            </View>
            {weighted && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Stat label="Total volume" value={`${Math.round(toDisplay(stats.volume, unit)).toLocaleString()} ${unit}`} />
                <Stat label="Sessions" value={String(all.length)} />
              </View>
            )}
            {prev.length > 0 && (
              <Card style={{ marginTop: 8 }}>
                <Dim>Last session</Dim>
                <Text style={{ color: colors.text, marginTop: 2 }}>{prev.map((s) => fmtSet(s, ex.tracking, unit)).join('   ')}</Text>
              </Card>
            )}

            {rec && (
              <Card style={{ marginTop: 8, backgroundColor: colors.accentDim }}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>
                  {rec.kind === 'deload' ? 'NEXT SESSION: GO LIGHTER' : 'NEXT SESSION'}
                </Text>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 2 }}>
                  {fmtSet(rec, ex.tracking, unit)}  ·  {rec.sets} set{rec.sets === 1 ? '' : 's'}
                </Text>
                <Text style={{ color: colors.textDim, marginTop: 4, lineHeight: 20 }}>{rec.reason}</Text>
              </Card>
            )}

            {ex.tracking === 'weighted' && (
              <>
                <SectionTitle>Progress</SectionTitle>
                <View style={{ height: 44 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {PERIODS.map((p) => (
                      <Chip key={p.key} label={p.label} active={p.key === period} onPress={() => setPeriod(p.key)} />
                    ))}
                  </ScrollView>
                </View>
                <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
                  <Chip label="Est. 1RM" active={metric === 'best1RM'} onPress={() => setMetric('best1RM')} />
                  <Chip label="Top weight" active={metric === 'topWeight'} onPress={() => setMetric('topWeight')} />
                  <Chip label="Volume" active={metric === 'volume'} onPress={() => setMetric('volume')} />
                </View>
                <Card>
                  {values.length === 0 ? (
                    <Dim style={{ textAlign: 'center', paddingVertical: 24 }}>No sessions in this period.</Dim>
                  ) : (
                    <LineChart values={values} labels={labels} width={Math.min(width, 520) - spacing.lg * 4} unitLabel={unit} />
                  )}
                </Card>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Stat label="Latest" value={last !== undefined ? `${Math.round(last)} ${unit}` : '-'} />
                  <Stat
                    label="Change in period"
                    value={change === null ? '-' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}
                    style={{ backgroundColor: colors.cardAlt }}
                  />
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
