import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Card, Chip, ChipRow, Dim, SectionTitle, Stat } from '../components/ui';
import { colors, fmtDate, spacing } from '../theme';
import { findExercise, toDisplay, useStore } from '../store/useStore';
import { currentRecords, DAY, personalRecords } from '../lib/stats';
import { fmtKg } from '../lib/format';

type Tab = 'records' | 'feed';

export default function RecordsScreen() {
  const nav = useNavigation<any>();
  const workouts = useStore((s) => s.workouts);
  const custom = useStore((s) => s.customExercises);
  const unit = useStore((s) => s.profile.unit);
  const [tab, setTab] = useState<Tab>('records');

  const records = useMemo(() => currentRecords(workouts), [workouts]);
  const events = useMemo(() => personalRecords(workouts).sort((a, b) => b.date - a.date), [workouts]);
  const last30 = events.filter((e) => e.date >= Date.now() - 30 * DAY).length;
  const open = (id: string) => nav.navigate('ExerciseDetail', { id });

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="Exercises with records" value={String(records.length)} />
          <Stat label="New PRs" value={String(events.length)} />
          <Stat label="Last 30 days" value={String(last30)} />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <ChipRow>
            <Chip label="Best sets" active={tab === 'records'} onPress={() => setTab('records')} />
            <Chip label="PR history" active={tab === 'feed'} onPress={() => setTab('feed')} />
          </ChipRow>
        </View>

        {workouts.length === 0 && (
          <Card style={{ marginTop: spacing.md }}>
            <Dim>Finish a workout and your best sets show up here. A new PR is any session that beats your previous best on an exercise.</Dim>
          </Card>
        )}

        {tab === 'records' &&
          records.map((r) => {
            const ex = findExercise(r.exerciseId, custom);
            const weighted = !!r.maxWeight;
            return (
              <Pressable key={r.exerciseId} onPress={() => open(r.exerciseId)}>
                <Card style={{ marginTop: spacing.md }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{ex?.name ?? 'Unknown exercise'}</Text>
                  <Dim>{ex?.muscle}</Dim>
                  <View style={{ marginTop: spacing.sm }}>
                    {weighted ? (
                      <>
                        <Row label="Heaviest" value={`${fmtKg(r.maxWeight!.weightKg, unit)} × ${r.maxWeight!.reps}`} date={r.maxWeight!.date} />
                        <Row label="Est. 1RM" value={fmtKg(Math.round(r.best1RM!.value * 10) / 10, unit)} date={r.best1RM!.date} sub={`${toDisplay(r.best1RM!.weightKg, unit)} × ${r.best1RM!.reps}`} />
                        <Row label="Best set volume" value={fmtKg(Math.round(r.bestVolume!.value), unit)} date={r.bestVolume!.date} sub={`${toDisplay(r.bestVolume!.weightKg, unit)} × ${r.bestVolume!.reps}`} />
                      </>
                    ) : (
                      <Row label="Most reps" value={`${r.maxReps!.value}`} date={r.maxReps!.date} />
                    )}
                  </View>
                </Card>
              </Pressable>
            );
          })}

        {tab === 'feed' && (
          <>
            {events.length === 0 && workouts.length > 0 && (
              <Card style={{ marginTop: spacing.md }}>
                <Dim>No PRs yet. Your first session of an exercise sets the baseline; beat it next time to earn a PR.</Dim>
              </Card>
            )}
            {events.slice(0, 100).map((e, i) => {
              const ex = findExercise(e.exerciseId, custom);
              const gain = e.value - e.previous;
              return (
                <Pressable key={`${e.workoutId}-${e.exerciseId}-${e.type}-${i}`} onPress={() => open(e.exerciseId)}>
                  <Card style={{ marginTop: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.accent, fontWeight: '800' }}>
                        {e.type === 'est_1rm' ? 'NEW EST. 1RM' : 'NEW HEAVIEST WEIGHT'}
                      </Text>
                      <Dim>{fmtDate(e.date)}</Dim>
                    </View>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 4 }}>{ex?.name ?? 'Unknown exercise'}</Text>
                    <Dim style={{ marginTop: 2 }}>
                      {fmtKg(Math.round(e.value * 10) / 10, unit)} (up {toDisplay(Math.round(gain * 10) / 10, unit)} {unit} from {fmtKg(Math.round(e.previous * 10) / 10, unit)})
                    </Dim>
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ label, value, date, sub }: { label: string; value: string; date: number; sub?: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, alignItems: 'center' }}>
    <View>
      <Text style={{ color: colors.textDim }}>{label}</Text>
      {!!sub && <Text style={{ color: colors.textDim, fontSize: 12 }}>{sub}</Text>}
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textDim, fontSize: 12 }}>{fmtDate(date)}</Text>
    </View>
  </View>
);
