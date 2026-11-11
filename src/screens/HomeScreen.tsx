import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Avatar, Button, Card, Dim, SectionTitle, Stat } from '../components/ui';
import { colors, radius, spacing } from '../theme';
import {
  computeRanks, findExercise, muscleSummaries, overallRank, useStore,
} from '../store/useStore';
import { RANK_COLORS } from '../data/ranks';
import { WEEKDAYS } from '../data/options';
import {
  biggestImprovement, consistency, personalRecords, totals, weekActivity, weekStreak,
} from '../lib/stats';
import { fmtKg } from '../lib/format';

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const profile = useStore((s) => s.profile);
  const workouts = useStore((s) => s.workouts);
  const active = useStore((s) => s.active);
  const custom = useStore((s) => s.customExercises);
  const avatarUri = useStore((s) => s.avatarUri);
  const startWorkout = useStore((s) => s.startWorkout);
  const addExercise = useStore((s) => s.addExercise);
  const unit = profile.unit;

  const now = Date.now();
  const data = useMemo(() => {
    const week = weekActivity(workouts, now);
    const ranks = computeRanks(workouts, profile, custom);
    const muscles = muscleSummaries(ranks);
    const scored = muscles.filter((m) => m.score !== null) as (typeof muscles[number] & { score: number })[];
    return {
      week,
      tot: totals(workouts),
      prs: personalRecords(workouts).length,
      streak: weekStreak(workouts, profile.sessionsPerWeek, now),
      cons: consistency(workouts, profile.sessionsPerWeek, now, 4),
      overall: overallRank(muscles),
      improve: biggestImprovement(workouts, now, 30),
      strongest: scored.length > 1 ? scored.reduce((a, b) => (b.score > a.score ? b : a)) : null,
      weakest: scored.length > 1 ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, profile, custom, Math.floor(now / 60000)]);

  const isTrainingDay = profile.trainingDays.includes(new Date().getDay());
  const suggested = profile.preferredExercises
    .map((id) => findExercise(id, custom))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .slice(0, 5);

  const startToday = () => {
    startWorkout();
    suggested.forEach((e) => addExercise(e.id));
    nav.navigate('Workout');
  };

  const insights: string[] = [];
  if (data.week.sessions > 0)
    insights.push(`You have trained ${data.week.sessions} time${data.week.sessions === 1 ? '' : 's'} this week (goal: ${profile.sessionsPerWeek}).`);
  if (data.improve) {
    const ex = findExercise(data.improve.exerciseId, custom);
    insights.push(`Your ${ex?.name ?? 'lift'} estimated max is up ${(data.improve.pct * 100).toFixed(1)}% in the last 30 days.`);
  }
  if (data.strongest && data.weakest && data.strongest.muscle !== data.weakest.muscle) {
    insights.push(`${data.strongest.muscle} is your highest-ranked muscle group right now.`);
    if (data.strongest.score - data.weakest.score >= 1.5)
      insights.push(`${data.weakest.muscle} is your lowest-ranked muscle group and has the most room to grow.`);
  }

  const dayDots = data.week.days;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        {/* Welcome */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar uri={avatarUri} name={profile.name} size={54} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textDim }}>Welcome back</Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>{profile.name || 'Lifter'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          <Pill
            label={data.overall ? data.overall.rank.rank : 'Unranked'}
            color={data.overall ? RANK_COLORS[data.overall.rank.rank] : colors.textDim}
          />
          <Pill label={`${data.streak} week streak`} color={data.streak > 0 ? colors.accent : colors.textDim} />
        </View>

        {/* Today's workout */}
        <SectionTitle>Today</SectionTitle>
        <Card>
          {active ? (
            <>
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>WORKOUT IN PROGRESS</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{active.name}</Text>
              <Dim style={{ marginTop: 2 }}>
                {active.exercises.length} exercise{active.exercises.length === 1 ? '' : 's'} added
              </Dim>
              <Button title="Continue workout" onPress={() => nav.navigate('Workout')} style={{ marginTop: spacing.md }} />
            </>
          ) : (
            <>
              <Text style={{ color: isTrainingDay ? colors.accent : colors.textDim, fontWeight: '800', fontSize: 12 }}>
                {isTrainingDay ? 'TRAINING DAY' : 'REST DAY'}
              </Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}>
                {isTrainingDay ? 'Ready when you are' : 'Recover, or train anyway'}
              </Text>
              <Dim style={{ marginTop: 2 }}>About {profile.durationMin} min planned</Dim>
              {suggested.length > 0 && (
                <Dim style={{ marginTop: 8 }}>Your favourites: {suggested.map((e) => e.name).join(', ')}</Dim>
              )}
              <Button title="Start workout" onPress={startToday} style={{ marginTop: spacing.md }} />
            </>
          )}
        </Card>

        {/* Strength overview */}
        <SectionTitle>Strength overview</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="Workouts" value={String(data.tot.count)} />
          <Stat label="Total volume" value={fmtKg(data.tot.volumeKg, unit)} />
          <Stat label="PRs" value={String(data.prs)} />
        </View>

        {/* Weekly activity */}
        <SectionTitle>This week</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {WEEKDAYS.map((w, i) => {
              const day = dayDots[i];
              const trained = day.count > 0;
              return (
                <View key={w.value} style={{ alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: trained ? colors.accent : colors.cardAlt,
                      borderWidth: day.isToday ? 2 : 0, borderColor: colors.accent,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: trained ? colors.onAccent : colors.textDim, fontWeight: '800' }}>{trained ? '✓' : ''}</Text>
                  </View>
                  <Text style={{ color: day.isToday ? colors.accent : colors.textDim, fontSize: 12, fontWeight: '700' }}>{w.long}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.lg }}>
            <Stat label="Sessions" value={`${data.week.sessions}/${profile.sessionsPerWeek}`} />
            <Stat label="Week volume" value={fmtKg(data.week.volumeKg, unit)} />
            <Stat label="Consistency" value={`${Math.round(data.cons * 100)}%`} />
          </View>
        </Card>

        {/* Progress overview */}
        <SectionTitle>Progress</SectionTitle>
        {workouts.length === 0 ? (
          <Card>
            <Dim>Finish your first workout and your progress, ranks and insights will show up here.</Dim>
          </Card>
        ) : (
          <Card>
            {insights.length === 0 ? (
              <Dim>Keep logging. Insights appear once you have a few sessions of the same exercises.</Dim>
            ) : (
              insights.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: i === insights.length - 1 ? 0 : 10 }}>
                  <Text style={{ color: colors.accent }}>●</Text>
                  <Text style={{ color: colors.text, flex: 1, lineHeight: 20 }}>{t}</Text>
                </View>
              ))
            )}
          </Card>
        )}

        {/* Quick actions */}
        <SectionTitle>Quick actions</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Action label="Start workout" onPress={() => { if (!active) startWorkout(); nav.navigate('Workout'); }} primary />
          <Action label="Log exercise" onPress={() => nav.navigate('Workout', { openPicker: true })} />
          <Action label="View progress" onPress={() => nav.navigate('Exercises')} />
          <Action label="View rankings" onPress={() => nav.navigate('Rankings')} />
          <Action label="Analytics" onPress={() => nav.navigate('Analytics')} />
          <Action label="Calendar" onPress={() => nav.navigate('Calendar')} />
          <Action label="Personal records" onPress={() => nav.navigate('Records')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Pill = ({ label, color }: { label: string; color: string }) => (
  <View style={{ borderWidth: 1, borderColor: color, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 }}>
    <Text style={{ color, fontWeight: '800', fontSize: 13 }}>{label}</Text>
  </View>
);

const Action = ({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      width: '48.5%',
      paddingVertical: 16,
      borderRadius: radius.md,
      alignItems: 'center',
      backgroundColor: primary ? colors.accent : colors.card,
      borderWidth: 1,
      borderColor: primary ? colors.accent : colors.border,
      opacity: pressed ? 0.8 : 1,
    })}
  >
    <Text style={{ color: primary ? colors.onAccent : colors.text, fontWeight: '800' }}>{label}</Text>
  </Pressable>
);
