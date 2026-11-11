import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, ChipRow, Dim, Field } from './ui';
import { colors, radius, spacing } from '../theme';
import { MUSCLES, Muscle, TrackingType } from '../data/exercises';
import { allExercises, useStore } from '../store/useStore';

const TRACKING: { key: TrackingType; label: string }[] = [
  { key: 'weighted', label: 'Weight × reps' },
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'assisted', label: 'Assisted' },
  { key: 'timed', label: 'Timed' },
  { key: 'cardio', label: 'Cardio' },
];

export function CreateExerciseForm({ onCreate }: { onCreate: (name: string, muscle: Muscle, tracking: TrackingType) => void }) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<Muscle>('Chest');
  const [tracking, setTracking] = useState<TrackingType>('weighted');
  const [error, setError] = useState<string | undefined>();
  return (
    <View>
      <Field label="Exercise name" value={name} onChangeText={(t) => { setName(t); setError(undefined); }} placeholder="e.g. Zercher Squat" error={error} maxLength={80} />
      <Text style={{ color: colors.textDim, fontSize: 13, marginBottom: 6 }}>Primary muscle</Text>
      <ChipRow>
        {MUSCLES.map((m) => (
          <Chip key={m} label={m} active={m === muscle} onPress={() => setMuscle(m)} />
        ))}
      </ChipRow>
      <Text style={{ color: colors.textDim, fontSize: 13, marginTop: spacing.md, marginBottom: 6 }}>How do you track it?</Text>
      <ChipRow>
        {TRACKING.map((t) => (
          <Chip key={t.key} label={t.label} active={t.key === tracking} onPress={() => setTracking(t.key)} />
        ))}
      </ChipRow>
      <Button
        title="Create exercise"
        onPress={() => {
          if (name.trim().length < 2) return setError('Enter a name (at least 2 characters).');
          onCreate(name.trim(), muscle, tracking);
          setName('');
        }}
        style={{ marginTop: spacing.lg }}
      />
    </View>
  );
}

export default function ExercisePicker({
  visible, onClose, onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
}) {
  const custom = useStore((s) => s.customExercises);
  const addCustomExercise = useStore((s) => s.addCustomExercise);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'All'>('All');
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return allExercises(custom).filter(
      (e) => (muscle === 'All' || e.muscle === muscle) && (!ql || e.name.toLowerCase().includes(ql)),
    );
  }, [q, muscle, custom]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg, flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{creating ? 'New exercise' : 'Add exercise'}</Text>
            <Pressable onPress={creating ? () => setCreating(false) : onClose}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>{creating ? 'Back' : 'Close'}</Text>
            </Pressable>
          </View>

          {creating ? (
            <ScrollView keyboardShouldPersistTaps="handled">
              <CreateExerciseForm
                onCreate={(name, m, t) => {
                  const id = addCustomExercise(name, m, t);
                  setCreating(false);
                  onPick(id);
                }}
              />
            </ScrollView>
          ) : (
            <>
              <TextInput
                style={{ backgroundColor: colors.cardAlt, color: colors.text, borderRadius: radius.sm, padding: 12, fontSize: 16, marginBottom: spacing.md }}
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
              <FlatList
                data={list}
                keyExtractor={(e) => e.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable onPress={() => onPick(item.id)} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.text, fontSize: 16 }}>{item.name}</Text>
                    <Dim>{item.muscle} · {item.equipment}</Dim>
                  </Pressable>
                )}
                ListEmptyComponent={<Dim style={{ textAlign: 'center', marginTop: 24 }}>No exercises match your search.</Dim>}
                ListFooterComponent={<Button title="+ Create custom exercise" variant="ghost" onPress={() => setCreating(true)} style={{ marginTop: spacing.lg }} />}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
