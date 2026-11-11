import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Chip, Dim, Button } from '../components/ui';
import { CreateExerciseForm } from '../components/ExercisePicker';
import { colors, radius, spacing } from '../theme';
import { MUSCLES, Muscle } from '../data/exercises';
import { allExercises, best1RMFor, useStore, toDisplay } from '../store/useStore';

export default function ExercisesScreen() {
  const nav = useNavigation<any>();
  const custom = useStore((s) => s.customExercises);
  const workouts = useStore((s) => s.workouts);
  const unit = useStore((s) => s.profile.unit);
  const addCustomExercise = useStore((s) => s.addCustomExercise);

  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'All'>('All');
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const done = new Set<string>();
    workouts.forEach((w) => w.exercises.forEach((e) => done.add(e.exerciseId)));
    return allExercises(custom)
      .filter((e) => (muscle === 'All' || e.muscle === muscle) && (!ql || e.name.toLowerCase().includes(ql)))
      // exercises you have logged come first
      .sort((a, b) => Number(done.has(b.id)) - Number(done.has(a.id)) || a.name.localeCompare(b.name));
  }, [q, muscle, custom, workouts]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>Exercises</Text>
          <Text onPress={() => setCreating(true)} style={{ color: colors.accent, fontWeight: '800' }}>+ Custom</Text>
        </View>
        <TextInput
          style={{ backgroundColor: colors.cardAlt, color: colors.text, borderRadius: radius.sm, padding: 12, fontSize: 16, marginVertical: spacing.md }}
          placeholder="Search exercises"
          placeholderTextColor={colors.textDim}
          value={q}
          onChangeText={setQ}
        />
        <View style={{ height: 44 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip label="All" active={muscle === 'All'} onPress={() => setMuscle('All')} />
            {MUSCLES.map((m) => (
              <Chip key={m} label={m} active={muscle === m} onPress={() => setMuscle(m)} />
            ))}
          </ScrollView>
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.lg }}
        data={list}
        keyExtractor={(e) => e.id}
        ListEmptyComponent={<Dim style={{ textAlign: 'center', marginTop: 40 }}>No exercises match your search.</Dim>}
        renderItem={({ item }) => {
          const orm = item.tracking === 'weighted' ? best1RMFor(workouts, item.id) : 0;
          return (
            <Pressable
              onPress={() => nav.navigate('ExerciseDetail', { id: item.id })}
              style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                <Dim>{item.muscle} · {item.equipment} · {item.difficulty}</Dim>
              </View>
              {orm > 0 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>{Math.round(toDisplay(orm, unit))} {unit}</Text>
                  <Dim>est. 1RM</Dim>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>New exercise</Text>
              <Text onPress={() => setCreating(false)} style={{ color: colors.accent, fontWeight: '700' }}>Close</Text>
            </View>
            <CreateExerciseForm
              onCreate={(name, m, t) => {
                const id = addCustomExercise(name, m, t);
                setCreating(false);
                nav.navigate('ExerciseDetail', { id });
              }}
            />
            <Button title="Cancel" variant="ghost" onPress={() => setCreating(false)} style={{ marginTop: spacing.sm }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
