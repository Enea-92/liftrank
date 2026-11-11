import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { confirmAction } from '../lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, findExercise, toDisplay } from '../store/useStore';
import { fmtSet } from '../lib/format';
import { Card, Dim } from '../components/ui';
import { colors, spacing, fmtDate, fmtDuration } from '../theme';

export default function HistoryScreen() {
  const workouts = useStore((s) => s.workouts);
  const unit = useStore((s) => s.profile.unit);
  const custom = useStore((s) => s.customExercises);
  const del = useStore((s) => s.deleteWorkout);

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: spacing.lg }}
        data={workouts}
        keyExtractor={(w) => w.id}
        
        ListEmptyComponent={<Dim style={{ textAlign: 'center', marginTop: 40 }}>No workouts yet. Finish one and it shows up here.</Dim>}
        renderItem={({ item: w }) => {
          const volume = w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weightKg * s.reps, 0), 0);
          return (
            <View>
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{w.name}</Text>
                  <Dim>{fmtDate(w.startedAt)}</Dim>
                </View>
                <Dim style={{ marginTop: 2, marginBottom: spacing.sm }}>
                  {w.finishedAt ? fmtDuration(w.finishedAt - w.startedAt) + ' · ' : ''}
                  {Math.round(toDisplay(volume, unit)).toLocaleString()} {unit} volume
                </Dim>
                {w.exercises.map((e) => {
                  const ex = findExercise(e.exerciseId, custom);
                  const top = e.sets.length ? e.sets.reduce((m, s) => (s.weightKg > m.weightKg || (s.weightKg === m.weightKg && s.reps > m.reps) ? s : m), e.sets[0]) : null;
                  return (
                    <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                      <Text style={{ color: colors.text }}>{e.sets.length} × {ex?.name ?? 'Unknown exercise'}</Text>
                      {top && ex && <Dim>{fmtSet(top, ex.tracking, unit)}</Dim>}
                    </View>
                  );
                })}
                <Text
                  onPress={() =>
                    confirmAction({
                      title: 'Delete workout?',
                      message: w.name,
                      confirmLabel: 'Delete',
                      destructive: true,
                      onConfirm: () => del(w.id),
                    })
                  }
                  style={{ color: colors.danger, marginTop: spacing.sm, alignSelf: 'flex-end', fontWeight: '600' }}
                >
                  Delete
                </Text>
              </Card>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
