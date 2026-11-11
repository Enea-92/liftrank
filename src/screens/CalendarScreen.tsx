import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Dim, SectionTitle, Stat } from '../components/ui';
import { colors, fmtDuration, spacing } from '../theme';
import { findExercise, useStore } from '../store/useStore';
import { monthGrid, startOfDay, workoutVolume, workoutsByDay } from '../lib/stats';
import { fmtKg } from '../lib/format';

const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarScreen() {
  const nav = useNavigation<any>();
  const workouts = useStore((s) => s.workouts);
  const custom = useStore((s) => s.customExercises);
  const unit = useStore((s) => s.profile.unit);
  const active = useStore((s) => s.active);
  const startFromWorkout = useStore((s) => s.startFromWorkout);

  const today = startOfDay(Date.now());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState<number>(today);

  const byDay = useMemo(() => workoutsByDay(workouts), [workouts]);
  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const monthDays = grid.flat().filter((d): d is number => d !== null);
  const trainedDays = monthDays.filter((d) => byDay.has(d));
  const monthWorkouts = trainedDays.reduce((a, d) => a + byDay.get(d)!.length, 0);
  const monthVolume = trainedDays.reduce((a, d) => a + byDay.get(d)!.reduce((v, w) => v + workoutVolume(w), 0), 0);

  const shift = (n: number) => {
    const d = new Date(cursor.y, cursor.m + n, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const title = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const dayWorkouts = byDay.get(selected) ?? [];

  const repeat = (id: string) => {
    startFromWorkout(id);
    nav.navigate('Main', { screen: 'Workout' });
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text onPress={() => shift(-1)} style={{ color: colors.accent, fontSize: 28, paddingHorizontal: 12 }} accessibilityLabel="Previous month">‹</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{title}</Text>
          <Text onPress={() => shift(1)} style={{ color: colors.accent, fontSize: 28, paddingHorizontal: 12 }} accessibilityLabel="Next month">›</Text>
        </View>

        <Card>
          <View style={{ flexDirection: 'row' }}>
            {HEAD.map((h, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.textDim, fontWeight: '700', marginBottom: 6 }}>{h}</Text>
            ))}
          </View>
          {grid.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((d, di) => {
                if (d === null) return <View key={di} style={{ flex: 1, height: 44 }} />;
                const n = byDay.get(d)?.length ?? 0;
                const isToday = d === today;
                const isSel = d === selected;
                return (
                  <Pressable key={di} onPress={() => setSelected(d)} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <View
                      style={{
                        width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: n > 0 ? colors.accent : 'transparent',
                        borderWidth: isSel ? 2 : isToday ? 1 : 0,
                        borderColor: isSel ? colors.text : colors.accent,
                      }}
                    >
                      <Text style={{ color: n > 0 ? colors.onAccent : colors.text, fontWeight: n > 0 || isToday ? '800' : '500' }}>
                        {new Date(d).getDate()}
                      </Text>
                    </View>
                    {n > 1 && <Text style={{ position: 'absolute', top: 0, right: 4, color: colors.accent, fontSize: 10, fontWeight: '800' }}>{n}</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          <Stat label="Workouts" value={String(monthWorkouts)} />
          <Stat label="Days trained" value={String(trainedDays.length)} />
          <Stat label="Volume" value={fmtKg(monthVolume, unit)} />
        </View>

        <SectionTitle>{new Date(selected).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</SectionTitle>
        {dayWorkouts.length === 0 && <Dim>{selected > today ? 'Nothing planned for this day.' : 'No workout on this day.'}</Dim>}
        {dayWorkouts.map((w) => (
          <Card key={w.id} style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{w.name}</Text>
            <Dim style={{ marginBottom: spacing.sm }}>
              {w.finishedAt ? fmtDuration(w.finishedAt - w.startedAt) + ' · ' : ''}
              {fmtKg(Math.round(workoutVolume(w)), unit)} volume
            </Dim>
            {w.exercises.map((e) => (
              <Pressable key={e.id} onPress={() => nav.navigate('ExerciseDetail', { id: e.exerciseId })}>
                <Text style={{ color: colors.text, paddingVertical: 2 }}>{e.sets.length} × {findExercise(e.exerciseId, custom)?.name ?? 'Unknown exercise'}</Text>
              </Pressable>
            ))}
            {!!w.notes && <Dim style={{ marginTop: 6 }}>{w.notes}</Dim>}
            {!active && <Button title="Repeat this workout" variant="ghost" onPress={() => repeat(w.id)} style={{ marginTop: spacing.md }} />}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
