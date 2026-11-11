import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Card, Chip, ChipRow, Dim, ProgressBar, SectionTitle, Stat } from '../components/ui';
import BarChart from '../components/BarChart';
import { colors, fmtDuration, spacing } from '../theme';
import { findExercise, toDisplay, useStore } from '../store/useStore';
import { DAY, averageDuration, exerciseTotals, groupTotals, weeklyBuckets } from '../lib/stats';
import { fmtKg } from '../lib/format';
import { MUSCLES } from '../data/exercises';

const RANGES = [
  { key: 4, label: '4 weeks' },
  { key: 12, label: '12 weeks' },
  { key: 26, label: '26 weeks' },
];

const fmtNum = (n: number) => Math.round(n).toLocaleString();
const shortDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function AnalyticsScreen() {
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const workouts = useStore((s) => s.workouts);
  const custom = useStore((s) => s.customExercises);
  const unit = useStore((s) => s.profile.unit);
  const goal = useStore((s) => s.profile.sessionsPerWeek);
  const [weeks, setWeeks] = useState(12);

  const chartW = Math.min(width, 520) - spacing.lg * 4;
  const now = Date.now();

  const d = useMemo(() => {
    const buckets = weeklyBuckets(workouts, weeks, now);
    const since = now - 30 * DAY;
    const muscle = groupTotals(workouts, (id) => findExercise(id, custom)?.muscle, since);
    const category = groupTotals(workouts, (id) => findExercise(id, custom)?.category, since);
    const inRange = workouts.filter((w) => (w.finishedAt ?? w.startedAt) >= buckets[0].start);
    return {
      buckets,
      muscle,
      category,
      top: exerciseTotals(workouts).slice(0, 8),
      sessions: buckets.reduce((a, b) => a + b.sessions, 0),
      volume: buckets.reduce((a, b) => a + b.volumeKg, 0),
      avgDur: averageDuration(inRange),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, custom, weeks, Math.floor(now / 60000)]);

  const muscleRows = MUSCLES.map((m) => ({ m, sets: d.muscle[m]?.sets ?? 0 }));
  const totalMuscleSets = muscleRows.reduce((a, r) => a + r.sets, 0);
  const maxMuscle = Math.max(1, ...muscleRows.map((r) => r.sets));
  const untrained = muscleRows.filter((r) => r.sets === 0).map((r) => r.m);

  const push = d.category.Push?.sets ?? 0;
  const pull = d.category.Pull?.sets ?? 0;
  let balance: string | null = null;
  if (push >= 6 && pull >= 6) {
    const ratio = push / pull;
    if (ratio > 1.5) balance = `You did ${push} push sets and ${pull} pull sets in the last 30 days. Adding rows or pulldowns would balance your shoulders.`;
    else if (ratio < 0.67) balance = `You did ${pull} pull sets and ${push} push sets in the last 30 days. Adding presses would balance things out.`;
  }

  const catRows = (['Push', 'Pull', 'Legs', 'Core', 'Cardio'] as const)
    .map((c) => ({ c, sets: d.category[c]?.sets ?? 0 }))
    .filter((r) => r.sets > 0);
  const totalCat = catRows.reduce((a, r) => a + r.sets, 0);

  if (workouts.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>No data yet</Text>
          <Dim style={{ marginTop: 6 }}>Log a few workouts and your weekly volume, muscle balance and top exercises will appear here.</Dim>
        </Card>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }}>
        <ChipRow>
          {RANGES.map((r) => (
            <Chip key={r.key} label={r.label} active={weeks === r.key} onPress={() => setWeeks(r.key)} />
          ))}
        </ChipRow>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          <Stat label="Workouts" value={String(d.sessions)} />
          <Stat label="Per week" value={(d.sessions / weeks).toFixed(1)} />
          <Stat label="Avg time" value={d.avgDur ? fmtDuration(d.avgDur) : '-'} />
        </View>

        <SectionTitle>Workouts per week</SectionTitle>
        <Card>
          <BarChart
            values={d.buckets.map((b) => b.sessions)}
            labels={d.buckets.map((b) => shortDate(b.start))}
            width={chartW}
            maxLabel={`max ${Math.max(...d.buckets.map((b) => b.sessions))}`}
          />
          <Dim style={{ marginTop: 6 }}>Your goal is {goal} per week. The last bar is the current week.</Dim>
        </Card>

        <SectionTitle>Weekly volume</SectionTitle>
        <Card>
          <BarChart
            values={d.buckets.map((b) => toDisplay(b.volumeKg, unit))}
            labels={d.buckets.map((b) => shortDate(b.start))}
            width={chartW}
            maxLabel={`max ${fmtNum(Math.max(...d.buckets.map((b) => toDisplay(b.volumeKg, unit))))} ${unit}`}
          />
          <Dim style={{ marginTop: 6 }}>Total in this period: {fmtKg(Math.round(d.volume), unit)} (weight × reps).</Dim>
        </Card>

        <SectionTitle>Muscles trained, last 30 days</SectionTitle>
        <Card>
          {muscleRows.map((r) => (
            <View key={r.m} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ color: r.sets ? colors.text : colors.textDim, fontWeight: '600' }}>{r.m}</Text>
                <Dim>
                  {r.sets} set{r.sets === 1 ? '' : 's'}
                  {totalMuscleSets > 0 && r.sets > 0 ? ` · ${Math.round((r.sets / totalMuscleSets) * 100)}%` : ''}
                </Dim>
              </View>
              <ProgressBar value={r.sets / maxMuscle} color={colors.accent} />
            </View>
          ))}
          {untrained.length > 0 && totalMuscleSets > 0 && (
            <Dim style={{ marginTop: 4 }}>Not trained in 30 days: {untrained.join(', ')}.</Dim>
          )}
        </Card>

        {catRows.length > 0 && (
          <>
            <SectionTitle>Training split, last 30 days</SectionTitle>
            <Card>
              {catRows.map((r) => (
                <View key={r.c} style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{r.c}</Text>
                    <Dim>{r.sets} set{r.sets === 1 ? '' : 's'} · {Math.round((r.sets / totalCat) * 100)}%</Dim>
                  </View>
                  <ProgressBar value={r.sets / totalCat} color={colors.accent} />
                </View>
              ))}
              {balance && <Text style={{ color: colors.text, marginTop: 6, lineHeight: 20 }}>{balance}</Text>}
            </Card>
          </>
        )}

        <SectionTitle>Top exercises by volume</SectionTitle>
        <Card>
          {d.top.map((t, i) => (
            <Pressable
              key={t.exerciseId}
              onPress={() => nav.navigate('ExerciseDetail', { id: t.exerciseId })}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{findExercise(t.exerciseId, custom)?.name ?? 'Unknown exercise'}</Text>
                <Dim>{t.sessions} session{t.sessions === 1 ? '' : 's'} · {t.sets} set{t.sets === 1 ? '' : 's'}</Dim>
              </View>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>{t.volumeKg > 0 ? fmtKg(Math.round(t.volumeKg), unit) : '-'}</Text>
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
