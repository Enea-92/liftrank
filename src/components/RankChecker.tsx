import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { Card, Chip, Dim, ProgressBar } from './ui';
import { colors, radius, spacing } from '../theme';
import { EXERCISES } from '../data/exercises';
import { RANKS, RANK_COLORS, STANDARDS, estimate1RM, rankFor } from '../data/ranks';
import { fromDisplay, toDisplay, useStore } from '../store/useStore';

const inputStyle = {
  backgroundColor: colors.cardAlt,
  color: colors.text,
  borderRadius: radius.sm,
  paddingVertical: 11,
  paddingHorizontal: 12,
  fontSize: 18,
  marginTop: 6,
} as const;

const RANKED = EXERCISES.filter((e) => e.ranked);

const num = (t: string) => {
  const n = parseFloat(t.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

/** Pick a lift, enter weight and reps, and see your strength rank right away (no workout needed). */
export default function RankChecker() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const { unit, sex } = profile;

  const [exerciseId, setExerciseId] = useState(RANKED[0].id);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [bw, setBw] = useState(String(toDisplay(profile.bodyweightKg, unit)));

  const w = num(weight);
  const r = Math.round(num(reps));
  const bodyKg = profile.bodyweightKg;

  const result = useMemo(() => {
    if (w <= 0 || r <= 0) return null;
    const oneRm = estimate1RM(fromDisplay(w, unit), r);
    return { oneRm, rank: rankFor(exerciseId, oneRm, bodyKg, sex) };
  }, [w, r, unit, exerciseId, bodyKg, sex]);

  const ladder = STANDARDS[exerciseId]?.[sex] ?? [];
  const exName = RANKED.find((e) => e.id === exerciseId)?.name ?? '';

  return (
    <Card style={{ marginBottom: spacing.xl }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Check your rank</Text>
      <Dim style={{ marginTop: 2, marginBottom: spacing.md }}>
        Pick a lift, enter the weight and reps of a hard set, and see where you stand.
      </Dim>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {RANKED.map((e) => (
          <Chip key={e.id} label={e.name} active={e.id === exerciseId} onPress={() => setExerciseId(e.id)} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Dim>Weight ({unit})</Dim>
          <TextInput
            style={inputStyle}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textDim}
            value={weight}
            onChangeText={setWeight}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Dim>Reps</Dim>
          <TextInput
            style={inputStyle}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textDim}
            value={reps}
            onChangeText={setReps}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Dim>Your bodyweight ({unit})</Dim>
          <TextInput
            style={inputStyle}
            keyboardType="decimal-pad"
            value={bw}
            onChangeText={(t) => {
              setBw(t);
              const n = num(t);
              if (n > 0) setProfile({ bodyweightKg: fromDisplay(n, unit) });
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
          <Chip label="Male" active={sex === 'male'} onPress={() => setProfile({ sex: 'male' })} />
          <Chip label="Female" active={sex === 'female'} onPress={() => setProfile({ sex: 'female' })} />
        </View>
      </View>

      {result?.rank ? (
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <Dim>{exName}</Dim>
          <Text style={{ fontSize: 32, fontWeight: '900', color: RANK_COLORS[result.rank.rank], marginVertical: 2 }}>
            {result.rank.rank}
          </Text>
          <Dim>
            Est. 1RM {Math.round(toDisplay(result.oneRm, unit))} {unit} · {(result.oneRm / bodyKg).toFixed(2)}× bodyweight
          </Dim>
          <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
            <ProgressBar value={result.rank.progressToNext} color={RANK_COLORS[result.rank.rank]} />
          </View>
          <Dim style={{ marginTop: 6, textAlign: 'center' }}>
            {result.rank.nextTarget
              ? `${Math.round(Math.max(0, toDisplay(result.rank.nextTarget - result.oneRm, unit)))} ${unit} more (est. 1RM) to reach ${RANKS[result.rank.rankIndex + 1] ?? 'the next rank'}`
              : 'Top rank reached!'}
          </Dim>
          {r > 12 && <Dim style={{ marginTop: 4, textAlign: 'center' }}>Estimates are less accurate above about 12 reps.</Dim>}
        </View>
      ) : (
        <Dim style={{ marginTop: spacing.lg, textAlign: 'center' }}>Enter weight and reps to see your rank.</Dim>
      )}

      {ladder.length > 0 && (
        <View style={{ marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
          <Dim style={{ marginBottom: 6 }}>
            {exName} rank ladder at {Math.round(toDisplay(bodyKg, unit))} {unit} bodyweight (1RM needed)
          </Dim>
          {RANKS.map((name, i) => (
            <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
              <Text style={{ color: RANK_COLORS[name], fontWeight: '700' }}>{name}</Text>
              <Text style={{ color: colors.text }}>
                {i === 0 ? `under ${Math.round(toDisplay(ladder[0] * bodyKg, unit))} ${unit}` : `${Math.round(toDisplay(ladder[i - 1] * bodyKg, unit))} ${unit}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
