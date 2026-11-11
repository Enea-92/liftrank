import React from 'react';
import { View, Text, ScrollView, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AccountCard from '../components/AccountCard';
import { notify, confirmAction } from '../lib/dialog';
import { useStore } from '../store/useStore';
import { Avatar, Button, Card, Chip, Dim, SectionTitle, Stat } from '../components/ui';
import { colors, spacing } from '../theme';
import { countryName, flag } from '../data/countries';
import { personalRecords, totals } from '../lib/stats';
import { fmtKg } from '../lib/format';
import { APP_NAME } from '../theme';

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const profile = useStore((s) => s.profile);
  const avatarUri = useStore((s) => s.avatarUri);
  const workouts = useStore((s) => s.workouts);
  const setProfile = useStore((s) => s.setProfile);
  const exportJson = useStore((s) => s.exportJson);
  const resetLocal = useStore((s) => s.resetLocal);
  const t = totals(workouts);

  const doExport = async () => {
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([exportJson()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${APP_NAME.toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: exportJson(), title: `${APP_NAME} backup` });
      }
    } catch (e) {
      notify('Could not export', String(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <Avatar uri={avatarUri} name={profile.name} size={96} />
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 12 }}>{profile.name || 'Lifter'}</Text>
          {!!profile.username && <Dim>@{profile.username}</Dim>}
          {!!profile.country && (
            <Dim style={{ marginTop: 2 }}>{flag(profile.country)} {countryName(profile.country)}</Dim>
          )}
          <Button title="Edit profile" variant="ghost" onPress={() => nav.navigate('EditProfile')} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="Workouts" value={String(t.count)} />
          <Stat label="Volume" value={fmtKg(t.volumeKg, profile.unit)} />
          <Stat label="PRs" value={String(personalRecords(workouts).length)} />
        </View>

        <SectionTitle>Training</SectionTitle>
        <Card>
          <Row k="Goal" v={profile.goal ?? '-'} />
          <Row k="Experience" v={profile.experience ?? '-'} />
          <Row k="Sessions per week" v={String(profile.sessionsPerWeek)} />
          <Row k="Bodyweight" v={fmtKg(profile.bodyweightKg, profile.unit)} />
        </Card>
        <Button title="Personal records" variant="ghost" onPress={() => nav.navigate('Records')} style={{ marginTop: spacing.md }} />
        <Button title="Analytics" variant="ghost" onPress={() => nav.navigate('Analytics')} style={{ marginTop: spacing.sm }} />
        <Button title="Calendar" variant="ghost" onPress={() => nav.navigate('Calendar')} style={{ marginTop: spacing.sm }} />
        <Button title="Workout history" variant="ghost" onPress={() => nav.navigate('History')} style={{ marginTop: spacing.sm }} />

        <SectionTitle>Units</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row' }}>
            <Chip label="kg" active={profile.unit === 'kg'} onPress={() => setProfile({ unit: 'kg' })} />
            <Chip label="lb" active={profile.unit === 'lb'} onPress={() => setProfile({ unit: 'lb' })} />
          </View>
        </Card>

        <SectionTitle>Account</SectionTitle>
        <AccountCard />

        <SectionTitle>Your data</SectionTitle>
        <Card>
          <Dim style={{ marginBottom: spacing.md }}>
            Workouts are saved on this device, and in the cloud too when you are signed in. Export a JSON backup any time.
          </Dim>
          <Button title="Export backup" variant="ghost" onPress={doExport} />
          <Button
            title="Reset data on this device"
            variant="danger"
            style={{ marginTop: spacing.sm }}
            onPress={() =>
              confirmAction({
                title: 'Reset local data?',
                message: 'Removes workouts and profile from this device. Cloud data is not deleted if you are signed in.',
                confirmLabel: 'Reset',
                destructive: true,
                onConfirm: resetLocal,
              })
            }
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Dim>{k}</Dim>
    <Text style={{ color: colors.text, fontWeight: '600', textTransform: 'capitalize' }}>{v}</Text>
  </View>
);
