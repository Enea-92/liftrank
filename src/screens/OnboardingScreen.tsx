import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Dim } from '../components/ui';
import AccountCard from '../components/AccountCard';
import { BasicsFields, BodyFields, Draft, EquipmentFields, TrainingFields, draftFrom } from '../components/ProfileFields';
import { APP_NAME, APP_TAGLINE, colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { Errors, validateBasics, validateBody, validateTraining } from '../lib/validate';
import { cloudConfigured } from '../lib/supabase';

const STEPS = ['Welcome', 'About you', 'Your body', 'Your training', 'Equipment'] as const;

export default function OnboardingScreen() {
  const profile = useStore((s) => s.profile);
  const avatarUri = useStore((s) => s.avatarUri);
  const setProfile = useStore((s) => s.setProfile);
  const setAvatar = useStore((s) => s.setAvatar);

  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => draftFrom(profile, avatarUri));
  const [errors, setErrors] = useState<Errors>({});
  const [showSignIn, setShowSignIn] = useState(false);

  const patch = (p: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...p }));
    // clear errors of the fields being edited
    setErrors({});
  };

  const next = () => {
    let e: Errors = {};
    if (step === 1) e = validateBasics(d);
    if (step === 2) e = validateBody(d);
    if (step === 3) e = validateTraining(d);
    setErrors(e);
    if (Object.keys(e).length) return;

    if (step === STEPS.length - 1) {
      const { avatarUri: av, ...p } = d;
      setProfile({ ...p, name: p.name.trim(), onboarded: true });
      setAvatar(av);
      return;
    }
    setStep(step + 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {step > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {STEPS.slice(1).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? colors.accent : colors.border }} />
              ))}
            </View>
            <Text style={{ color: colors.textDim, marginTop: 8, fontSize: 13 }}>
              Step {step} of {STEPS.length - 1}
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View style={{ paddingTop: 40 }}>
              <Text style={{ color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 13 }}>{APP_TAGLINE}</Text>
              <Text style={{ color: colors.text, fontSize: 40, fontWeight: '900', marginTop: 8 }}>{APP_NAME}</Text>
              <Text style={{ color: colors.textDim, fontSize: 16, marginTop: 12, lineHeight: 24 }}>
                Log your workouts in seconds, see your strength improve, and rank every muscle. Free, with no subscription.
              </Text>
              <Button title="Get started" onPress={next} style={{ marginTop: 32 }} />
              {cloudConfigured && (
                <>
                  <Button
                    title={showSignIn ? 'Hide sign in' : 'I already have an account'}
                    variant="ghost"
                    onPress={() => setShowSignIn(!showSignIn)}
                    style={{ marginTop: 12 }}
                  />
                  {showSignIn && (
                    <View style={{ marginTop: spacing.lg }}>
                      <AccountCard />
                      <Dim>After you sign in, your profile and workouts load automatically.</Dim>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.h}>About you</Text>
              <BasicsFields d={d} set={patch} errors={errors} />
            </View>
          )}
          {step === 2 && (
            <View>
              <Text style={styles.h}>Your body</Text>
              <BodyFields d={d} set={patch} errors={errors} />
            </View>
          )}
          {step === 3 && (
            <View>
              <Text style={styles.h}>Your training</Text>
              <TrainingFields d={d} set={patch} errors={errors} />
            </View>
          )}
          {step === 4 && (
            <View>
              <Text style={styles.h}>Equipment and favourites</Text>
              <Dim>Optional. This is used to suggest exercises for your workouts.</Dim>
              <EquipmentFields d={d} set={patch} errors={errors} />
            </View>
          )}

          {step > 0 && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xl }}>
              <Button title="Back" variant="ghost" onPress={() => { setErrors({}); setStep(step - 1); }} style={{ flex: 1 }} />
              <Button title={step === STEPS.length - 1 ? 'Finish' : 'Next'} onPress={next} style={{ flex: 2 }} />
            </View>
          )}
          {Object.keys(errors).length > 0 && (
            <Text style={{ color: colors.danger, marginTop: 12, textAlign: 'center' }}>Please fix the highlighted fields to continue.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  h: { color: colors.text, fontSize: 28, fontWeight: '800' as const, marginBottom: spacing.lg },
};
