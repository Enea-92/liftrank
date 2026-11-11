import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, allExercises, historyFor, toDisplay } from '../store/useStore';
import LineChart from '../components/LineChart';
import { Card, Chip, Dim, Title } from '../components/ui';
import { colors, spacing } from '../theme';

type Metric = 'best1RM' | 'topWeight' | 'volume';

export default function ProgressScreen() {
  const workouts = useStore((s) => s.workouts);
  const unit = useStore((s) => s.profile.unit);
  const custom = useStore((s) => s.customExercises);
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<Metric>('best1RM');
  const [selected, setSelected] = useState<string | null>(null);

  const done = useMemo(() => {
    const ids = new Set<string>();
    workouts.forEach((w) => w.exercises.forEach((e) => ids.add(e.exerciseId)));
    return allExercises(custom).filter((e) => ids.has(e.id));
  }, [workouts, custom]);

  const current = selected ?? done[0]?.id ?? null;
  const pts = current ? historyFor(workouts, current) : [];
  const values = pts.map((p) => toDisplay(p[metric], unit));
  const labels = pts.map((p) => new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

  const first = values[0];
  const last = values[values.length - 1];
  const change = values.length > 1 && first > 0 ? ((last - first) / first) * 100 : null;
  const bestPeriod = (() => {
    if (values.length < 2) return null;
    let best = { i: 0, d: -Infinity };
    for (let i = 1; i < values.length; i++) {
      const d = values[i] - values[i - 1];
      if (d > best.d) best = { i, d };
    }
    return best.d > 0 ? { from: labels[best.i - 1], to: labels[best.i], d: best.d } : null;
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Title>Progress</Title>
        {done.length === 0 ? (
          <Dim style={{ textAlign: 'center', marginTop: 40 }}>Log a workout to see your strength curve.</Dim>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {done.map((e) => (
                <Chip key={e.id} label={e.name} active={e.id === current} onPress={() => setSelected(e.id)} />
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
              <Chip label="Est. 1RM" active={metric === 'best1RM'} onPress={() => setMetric('best1RM')} />
              <Chip label="Top weight" active={metric === 'topWeight'} onPress={() => setMetric('topWeight')} />
              <Chip label="Volume" active={metric === 'volume'} onPress={() => setMetric('volume')} />
            </View>

            <Card>
              <LineChart values={values} labels={labels} width={width - spacing.lg * 4} unitLabel={unit} />
            </Card>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <Card style={{ flex: 1 }}>
                <Dim>Latest</Dim>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{last ? Math.round(last) : '—'} {unit}</Text>
              </Card>
              <Card style={{ flex: 1 }}>
                <Dim>Since first log</Dim>
                <Text style={{ color: change !== null && change >= 0 ? colors.accent : colors.danger, fontSize: 22, fontWeight: '800' }}>
                  {change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}
                </Text>
              </Card>
            </View>

            {bestPeriod && (
              <Card style={{ marginTop: spacing.md }}>
                <Dim>Best progress period</Dim>
                <Text style={{ color: colors.text, fontWeight: '700', marginTop: 2 }}>
                  {bestPeriod.from} → {bestPeriod.to}: +{Math.round(bestPeriod.d)} {unit}
                </Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
