import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Chip, ChipRow, Dim, Field } from './ui';
import { colors, radius, spacing } from '../theme';
import { COUNTRIES, countryName, flag } from '../data/countries';
import { DURATIONS, EXPERIENCE, GENDERS, GOALS, WEEKDAYS } from '../data/options';
import { EQUIPMENT, EXERCISES } from '../data/exercises';
import type { Profile } from '../store/useStore';
import { fromDisplay, toDisplay } from '../store/useStore';
import { Errors, parseNum, suggestUsername } from '../lib/validate';
import { notify } from '../lib/dialog';

export type Draft = Profile & { avatarUri: string | null };
interface Props {
  d: Draft;
  set: (patch: Partial<Draft>) => void;
  errors: Errors;
}

const Label: React.FC<{ children: React.ReactNode; error?: string }> = ({ children, error }) => (
  <View style={{ marginBottom: 6, marginTop: spacing.sm }}>
    <Text style={{ color: colors.textDim, fontSize: 13 }}>{children}</Text>
    {error ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 2 }}>{error}</Text> : null}
  </View>
);

export async function pickAvatar(): Promise<string | null> {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return null;
    const a = res.assets[0];
    return a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri;
  } catch (e) {
    notify('Could not open your photos', String(e));
    return null;
  }
}

function CountryPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (code: string) => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return COUNTRIES.filter((c) => !ql || c.name.toLowerCase().includes(ql));
  }, [q]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg, flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Country</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Close</Text>
            </Pressable>
          </View>
          <TextInput
            style={{ backgroundColor: colors.cardAlt, color: colors.text, borderRadius: radius.sm, padding: 12, fontSize: 16, marginBottom: spacing.md }}
            placeholder="Search countries"
            placeholderTextColor={colors.textDim}
            value={q}
            onChangeText={setQ}
          />
          <FlatList
            data={list}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onPick(item.code);
                  onClose();
                }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', gap: 10 }}
              >
                <Text style={{ fontSize: 18 }}>{flag(item.code)}</Text>
                <Text style={{ color: colors.text, fontSize: 16 }}>{item.name}</Text>
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function BasicsFields({ d, set, errors }: Props) {
  const [picker, setPicker] = useState(false);
  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
        <Pressable onPress={async () => { const u = await pickAvatar(); if (u) set({ avatarUri: u }); }}>
          <Avatar uri={d.avatarUri} name={d.name} size={88} />
        </Pressable>
        <Text
          onPress={async () => { const u = await pickAvatar(); if (u) set({ avatarUri: u }); }}
          style={{ color: colors.accent, fontWeight: '700', marginTop: 8 }}
        >
          {d.avatarUri ? 'Change photo' : 'Add profile picture'}
        </Text>
        {d.avatarUri ? (
          <Text onPress={() => set({ avatarUri: null })} style={{ color: colors.textDim, marginTop: 4, fontSize: 12 }}>
            Remove
          </Text>
        ) : null}
      </View>

      <Field
        label="Name"
        value={d.name}
        placeholder="Your name"
        error={errors.name}
        maxLength={60}
        onChangeText={(t) => {
          // keep the username suggestion in sync until the user edits it themselves
          if (!d.username || d.username === suggestUsername(d.name)) set({ name: t, username: suggestUsername(t) });
          else set({ name: t });
        }}
      />
      <Field
        label="Username"
        value={d.username}
        placeholder="lowercase_letters_123"
        autoCapitalize="none"
        maxLength={20}
        error={errors.username}
        hint="Friends use this to find you."
        onChangeText={(t) => set({ username: t.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
      />
      <Field
        label="Date of birth"
        value={d.dob ?? ''}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={errors.dob}
        onChangeText={(t) => set({ dob: t || null })}
      />

      <Label>Gender (optional)</Label>
      <ChipRow>
        {GENDERS.map((g) => (
          <Chip
            key={g.key}
            label={g.label}
            active={d.gender === g.key}
            onPress={() => set(g.key === 'male' || g.key === 'female' ? { gender: g.key, sex: g.key } : { gender: g.key })}
          />
        ))}
      </ChipRow>
      {(d.gender === 'other' || d.gender === 'prefer_not') && (
        <>
          <Label>Strength standards to use for your ranks</Label>
          <ChipRow>
            <Chip label="Male standards" active={d.sex === 'male'} onPress={() => set({ sex: 'male' })} />
            <Chip label="Female standards" active={d.sex === 'female'} onPress={() => set({ sex: 'female' })} />
          </ChipRow>
        </>
      )}

      <Label>Country</Label>
      <Pressable
        onPress={() => setPicker(true)}
        style={{ backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Text style={{ color: d.country ? colors.text : colors.textDim, fontSize: 16 }}>
          {d.country ? `${flag(d.country)}  ${countryName(d.country)}` : 'Select your country'}
        </Text>
        <Text style={{ color: colors.textDim }}>▾</Text>
      </Pressable>
      <CountryPicker visible={picker} onClose={() => setPicker(false)} onPick={(code) => set({ country: code })} />
    </View>
  );
}

export function BodyFields({ d, set, errors }: Props) {
  const [w, setW] = useState(String(toDisplay(d.bodyweightKg, d.unit)));
  const [h, setH] = useState(d.heightCm ? String(d.heightCm) : '');
  return (
    <View>
      <Label>Weight unit</Label>
      <ChipRow>
        <Chip
          label="KG"
          active={d.unit === 'kg'}
          onPress={() => {
            set({ unit: 'kg' });
            setW(String(toDisplay(d.bodyweightKg, 'kg')));
          }}
        />
        <Chip
          label="LB"
          active={d.unit === 'lb'}
          onPress={() => {
            set({ unit: 'lb' });
            setW(String(toDisplay(d.bodyweightKg, 'lb')));
          }}
        />
      </ChipRow>
      <View style={{ height: spacing.md }} />
      <Field
        label={`Bodyweight (${d.unit})`}
        value={w}
        keyboardType="decimal-pad"
        error={errors.weight}
        hint="Used to calculate your strength ranks."
        onChangeText={(t) => {
          setW(t);
          const n = parseNum(t);
          set({ bodyweightKg: Number.isFinite(n) ? fromDisplay(n, d.unit) : 0 });
        }}
      />
      <Field
        label="Height (cm)"
        value={h}
        keyboardType="decimal-pad"
        placeholder="Optional"
        error={errors.height}
        onChangeText={(t) => {
          setH(t);
          const n = parseNum(t);
          set({ heightCm: t.trim() === '' ? null : Number.isFinite(n) ? n : 0 });
        }}
      />
    </View>
  );
}

export function TrainingFields({ d, set, errors }: Props) {
  const toggleDay = (v: number) =>
    set({ trainingDays: d.trainingDays.includes(v) ? d.trainingDays.filter((x) => x !== v) : [...d.trainingDays, v] });
  return (
    <View>
      <Label error={errors.experience}>Fitness experience</Label>
      <ChipRow>
        {EXPERIENCE.map((x) => (
          <Chip key={x.key} label={x.label} active={d.experience === x.key} onPress={() => set({ experience: x.key })} />
        ))}
      </ChipRow>
      {d.experience && <Dim style={{ marginTop: 6 }}>{EXPERIENCE.find((x) => x.key === d.experience)?.hint}</Dim>}

      <Label error={errors.goal}>Main goal</Label>
      <ChipRow>
        {GOALS.map((g) => (
          <Chip key={g.key} label={g.label} active={d.goal === g.key} onPress={() => set({ goal: g.key })} />
        ))}
      </ChipRow>

      <Label error={errors.sessions}>Gym sessions per week</Label>
      <ChipRow>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Chip key={n} label={String(n)} active={d.sessionsPerWeek === n} onPress={() => set({ sessionsPerWeek: n })} />
        ))}
      </ChipRow>

      <Label>Preferred training days</Label>
      <ChipRow>
        {WEEKDAYS.map((w) => (
          <Chip key={w.value} label={w.long} active={d.trainingDays.includes(w.value)} onPress={() => toggleDay(w.value)} />
        ))}
      </ChipRow>
      {d.trainingDays.length !== d.sessionsPerWeek && d.trainingDays.length > 0 && (
        <Dim style={{ marginTop: 6 }}>
          You picked {d.trainingDays.length} day{d.trainingDays.length === 1 ? '' : 's'} but {d.sessionsPerWeek} session{d.sessionsPerWeek === 1 ? '' : 's'} a week. That is fine, days are just a guide.
        </Dim>
      )}

      <Label error={errors.duration}>Preferred workout duration</Label>
      <ChipRow>
        {DURATIONS.map((m) => (
          <Chip key={m} label={`${m} min`} active={d.durationMin === m} onPress={() => set({ durationMin: m })} />
        ))}
      </ChipRow>
    </View>
  );
}

export function EquipmentFields({ d, set }: Props) {
  const [q, setQ] = useState('');
  const toggleEq = (e: string) =>
    set({ equipment: d.equipment.includes(e) ? d.equipment.filter((x) => x !== e) : [...d.equipment, e] });
  const toggleEx = (id: string) =>
    set({ preferredExercises: d.preferredExercises.includes(id) ? d.preferredExercises.filter((x) => x !== id) : [...d.preferredExercises, id] });

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return EXERCISES.filter(
      (e) =>
        (!ql || e.name.toLowerCase().includes(ql)) &&
        (d.equipment.length === 0 || d.equipment.includes(e.equipment)),
    ).slice(0, 24);
  }, [q, d.equipment]);

  return (
    <View>
      <Label>Equipment you have access to</Label>
      <ChipRow>
        {EQUIPMENT.map((e) => (
          <Chip key={e} label={e} active={d.equipment.includes(e)} onPress={() => toggleEq(e)} />
        ))}
      </ChipRow>

      <Label>Favourite exercises ({d.preferredExercises.length} selected)</Label>
      <Field label="" value={q} onChangeText={setQ} placeholder="Search exercises" autoCapitalize="none" />
      <ChipRow>
        {shown.map((e) => (
          <Chip key={e.id} label={e.name} active={d.preferredExercises.includes(e.id)} onPress={() => toggleEx(e.id)} />
        ))}
      </ChipRow>
      {shown.length === 0 && <Dim>No exercises match.</Dim>}
    </View>
  );
}

export const draftFrom = (p: Profile, avatarUri: string | null): Draft => ({ ...p, avatarUri });

export const SaveBar: React.FC<{ title: string; onPress: () => void }> = ({ title, onPress }) => (
  <Button title={title} onPress={onPress} style={{ marginTop: spacing.lg }} />
);
