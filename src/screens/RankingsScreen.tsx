import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore, computeRanks, muscleSummaries, overallRank, toDisplay, allExercises } from '../store/useStore';
import { RANKS, RANK_COLORS } from '../data/ranks';
import type { Muscle } from '../data/exercises';
import { Card, Dim, ProgressBar, SectionTitle, Title } from '../components/ui';
import RankChecker from '../components/RankChecker';
import MuscleMap from '../components/MuscleMap';
import { colors, spacing } from '../theme';

export default function RankingsScreen() {
  const workouts = useStore((s) => s.workouts);
  const profile = useStore((s) => s.profile);
  const custom = useStore((s) => s.customExercises);
  const [selected, setSelected] = useState<Muscle | null>(null);

  const ranks = useMemo(() => computeRanks(workouts, profile, custom), [workouts, profile, custom]);
  const muscles = useMemo(() => muscleSummaries(ranks), [ranks]);
  const overall = overallRank(muscles);

  const scored = muscles.filter((m) => m.score !== null) as (typeof muscles[number] & { score: number })[];
  const weakest = scored.length > 1 ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  const strongest = scored.length > 1 ? scored.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  const mapColors = Object.fromEntries(muscles.map((m) => [m.muscle, m.rank ? m.rank.rank : null]));
  const sel = selected ? muscles.find((m) => m.muscle === selected) : null;
  const selLifts = selected ? ranks.filter((r) => r.exercise.muscle === selected) : [];
  const selTodo = selected
    ? allExercises(custom).filter((e) => e.ranked && e.muscle === selected && !selLifts.some((r) => r.exercise.id === e.id))
    : [];

  const overallColor = overall ? RANK_COLORS[overall.rank.rank] : colors.textDim;
  const overallFrac = overall ? (overall.rank.rankIndex >= RANKS.length - 1 ? 1 : overall.score - overall.rank.rankIndex) : 0;
  const nextName = overall ? RANKS[overall.rank.rankIndex + 1] : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Title>Rankings</Title>

        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Dim>Overall strength</Dim>
          <Text style={{ fontSize: 36, fontWeight: '900', color: overallColor, marginTop: 4 }}>
            {overall ? overall.rank.rank : 'Unranked'}
          </Text>
          {overall && <Dim>Level {overall.rank.rankIndex + 1} of {RANKS.length}</Dim>}
          {overall && nextName && (
            <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
              <ProgressBar value={overallFrac} color={overallColor} />
              <Dim style={{ textAlign: 'center', marginTop: 6 }}>{Math.round(overallFrac * 100)}% of the way to {nextName}</Dim>
            </View>
          )}
          {!overall && (
            <Dim style={{ textAlign: 'center', marginTop: 6 }}>
              Log a ranked lift (bench, squat, deadlift, press, row, curl, hip thrust...) to get your rank.
            </Dim>
          )}
          {overall && weakest && strongest && weakest.muscle !== strongest.muscle && (
            <Dim style={{ marginTop: 8, textAlign: 'center' }}>
              Strongest: {strongest.muscle} · Needs work: {weakest.muscle}
            </Dim>
          )}
        </Card>

        <SectionTitle>Muscle map</SectionTitle>
        <Card>
          <MuscleMap ranks={mapColors} selected={selected} onSelect={(m) => setSelected(m === selected ? null : m)} />
          {!selected && <Dim style={{ textAlign: 'center', marginTop: 8 }}>Tap a muscle to see its rank. Grey means no ranked lift logged yet.</Dim>}
          {sel && (
            <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{sel.muscle}</Text>
                <Text style={{ color: sel.rank ? RANK_COLORS[sel.rank.rank] : colors.textDim, fontWeight: '800', fontSize: 18 }}>
                  {sel.rank ? sel.rank.rank : 'Unranked'}
                </Text>
              </View>
              {selLifts.map((r) => (
                <Dim key={r.exercise.id} style={{ marginTop: 4 }}>
                  {r.exercise.name}: {r.result.rank} · est. 1RM {Math.round(toDisplay(r.oneRepMax, profile.unit))} {profile.unit}
                </Dim>
              ))}
              {selTodo.length > 0 && (
                <Dim style={{ marginTop: 6 }}>
                  {selLifts.length ? 'Also counts: ' : 'Log one of these to rank it: '}
                  {selTodo.map((e) => e.name).join(', ')}
                </Dim>
              )}
              {selTodo.length === 0 && selLifts.length === 0 && <Dim style={{ marginTop: 6 }}>No ranked lifts for this muscle.</Dim>}
            </View>
          )}
        </Card>

        <SectionTitle>Muscle balance</SectionTitle>
        <Card>
          {muscles.map((m) => (
            <Pressable key={m.muscle} onPress={() => setSelected(m.muscle === selected ? null : m.muscle)} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: colors.text, fontWeight: selected === m.muscle ? '900' : '600' }}>{m.muscle}</Text>
                <Text style={{ color: m.rank ? RANK_COLORS[m.rank.rank] : colors.textDim, fontWeight: '700' }}>
                  {m.rank ? m.rank.rank : 'No data'}
                </Text>
              </View>
              <ProgressBar value={m.score === null ? 0 : m.score / RANKS.length} color={m.rank ? RANK_COLORS[m.rank.rank] : colors.border} />
            </Pressable>
          ))}
        </Card>

        <SectionTitle>Lifts</SectionTitle>
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

        <SectionTitle>Check a lift</SectionTitle>
        <RankChecker />

        <SectionTitle>The 11 ranks</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RANKS.map((n, i) => (
              <View key={n} style={{ borderWidth: 1, borderColor: RANK_COLORS[n], borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
                <Text style={{ color: RANK_COLORS[n], fontWeight: '700', fontSize: 12 }}>{i + 1}. {n}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Dim style={{ marginTop: spacing.md }}>
          Ranks compare your estimated one-rep max to your bodyweight using approximate population strength standards. Update your bodyweight and sex in Profile for accurate ranks.
        </Dim>
      </ScrollView>
    </SafeAreaView>
  );
}
