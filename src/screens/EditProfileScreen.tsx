import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BasicsFields, BodyFields, Draft, EquipmentFields, TrainingFields, draftFrom } from '../components/ProfileFields';
import { Button, Card } from '../components/ui';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { Errors, validateBasics, validateBody, validateTraining } from '../lib/validate';

export default function EditProfileScreen() {
  const nav = useNavigation<any>();
  const profile = useStore((s) => s.profile);
  const avatarUri = useStore((s) => s.avatarUri);
  const setProfile = useStore((s) => s.setProfile);
  const setAvatar = useStore((s) => s.setAvatar);

  const [d, setD] = useState<Draft>(() => draftFrom(profile, avatarUri));
  const [errors, setErrors] = useState<Errors>({});

  const patch = (p: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...p }));
    setErrors({});
  };

  const save = () => {
    const e = { ...validateBasics(d), ...validateBody(d), ...validateTraining(d) };
    setErrors(e);
    if (Object.keys(e).length) return;
    const { avatarUri: av, ...p } = d;
    setProfile({ ...p, name: p.name.trim() });
    setAvatar(av);
    nav.goBack();
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: spacing.md }}>
          <BasicsFields d={d} set={patch} errors={errors} />
        </Card>
        <Card style={{ marginBottom: spacing.md }}>
          <BodyFields d={d} set={patch} errors={errors} />
        </Card>
        <Card style={{ marginBottom: spacing.md }}>
          <TrainingFields d={d} set={patch} errors={errors} />
        </Card>
        <Card>
          <EquipmentFields d={d} set={patch} errors={errors} />
        </Card>
        {Object.keys(errors).length > 0 && (
          <Text style={{ color: colors.danger, marginTop: 12, textAlign: 'center' }}>Please fix the highlighted fields.</Text>
        )}
        <View style={{ marginTop: spacing.lg }}>
          <Button title="Save changes" onPress={save} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
