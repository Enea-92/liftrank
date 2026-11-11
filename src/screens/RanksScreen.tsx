import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, computeRanks, muscleSummaries, overallRank, toDisplay } from '../store/useStore';
import { RANKS, RANK_COLORS } from '../data/ranks';
import { Card, Dim, ProgressBar, Title } from '../components/ui';
import { colors, spacing } from '../theme';

export default function RanksScreen() {
  const workouts = useStore((s) => s.workouts);
  const profile = useStore((s) => s.profile);
  const custom = useStore((s) => s.customExercises);

  const ranks = useMemo(() => computeRanks(workouts, profile, custom), [workouts, profile, custom]);
  const muscles = useMemo(() => muscleSummaries(ranks), [ranks]);
  const overall = overallRank(muscles);

  const scored = muscles.filter((m) => m.score !== null) as (typeof muscles[number] & { score: number })[];
  const weakest = scored.length > 1 ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  const strongest = scored.length > 1 ? scored.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Title>Ranks</Title>

        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Dim>Overall strength</Dim>
          <Text style={{ fontSize: 34, fontWeight: '900', color: overall ? RANK_COLORS[overall.rank.rank] : colors.textDim, marginTop: 4 }}>
            {overall ? overall.rank.rank : 'Unranked'}
          </Text>
          {!overall && (
            <Dim style={{ textAlign: 'center', marginTop: 6 }}>
              Log a ranked lift (bench, squat, deadlift, overhead press, row or curl) to get your rank.
            </Dim>
          )}
          {overall && weakest && strongest && weakest.muscle !== strongest.muscle && (
            <Dim style={{ marginTop: 8, textAlign: 'center' }}>
              Strongest: {strongest.muscle} · Needs work: {weakest.muscle}
            </Dim>
          )}
        </Card>

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.sm }}>Muscle balance</Text>
        <Card>
          {muscles.map((m) => (
            <View key={m.muscle} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{m.muscle}</Text>
                <Text style={{ color: m.rank ? RANK_COLORS[m.rank.rank] : colors.textDim, fontWeight: '700' }}>
                  {m.rank ? m.rank.rank : 'No data'}
                </Text>
              </View>
              <ProgressBar value={m.score === null ? 0 : m.score / RANKS.length} color={m.rank ? RANK_COLORS[m.rank.rank] : colors.border} />
            </View>
          ))}
        </Card>

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.sm }}>Lifts</Text>
        {ranks.length === 0 && <Dim>No ranked lifts logged yet.</Dim>}
        {ranks.map((r) => (
          <Card key={r.exercise.id} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{r.exercise.name}</Text>
              <Text style={{ color: RANK_COLORS[r.result.rank], fontWeight: '800' }}>{r.result.rank}</Text>
            </View>
            <Dim style={{ marginVertical: 4 }}>
              Est. 1RM {Math.round(toDisplay(r.oneRepMax, profile.unit))} {profile.unit}
              {r.result.nextTarget ? ` · next rank at ${Math.round(toDisplay(r.result.nextTarget, profile.unit))} ${profile.unit}` : ' · top rank!'}
            </Dim>
            <ProgressBar value={r.result.progressToNext} color={RANK_COLORS[r.result.rank]} />
          </Card>
        ))}

        <Dim style={{ marginTop: spacing.md }}>
          Ranks compare your estimated one-rep max to your bodyweight using approximate population strength standards. Update your bodyweight and sex in Profile for accurate ranks.
        </Dim>
      </ScrollView>
    </SafeAreaView>
  );
}
