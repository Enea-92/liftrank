import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Platform } from 'react-native';
import { Button, Card, Chip, Dim } from './ui';
import { colors, radius, spacing } from '../theme';
import { authProviders, cloudConfigured } from '../lib/supabase';
import { useAuth } from '../store/useAuth';
import { syncNow, useSyncStatus } from '../lib/sync';
import { confirmAction, notify } from '../lib/dialog';

const inputStyle = {
  backgroundColor: colors.cardAlt,
  color: colors.text,
  borderRadius: radius.sm,
  paddingVertical: 11,
  paddingHorizontal: 12,
  fontSize: 16,
  marginTop: 8,
} as const;

const timeAgo = (ts: number | null) => {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(ts).toLocaleString();
};

export default function AccountCard() {
  const { session, busy, signIn, signUp, signOut, signInWithOAuth, resetPassword, deleteAccount } = useAuth();
  const sync = useSyncStatus();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  if (!cloudConfigured) {
    return (
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>Account</Text>
        <Dim>
          Cloud accounts are not set up in this build, so your data is saved on this device only. To enable them,
          add your Supabase keys (see README).
        </Dim>
      </Card>
    );
  }

  if (session) {
    return (
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 2 }}>Account</Text>
        <Text style={{ color: colors.text }}>{session.user.email}</Text>
        <Dim style={{ marginTop: 6 }}>
          {sync.state === 'syncing' && 'Syncing…'}
          {sync.state === 'ok' && `Synced ${timeAgo(sync.lastSynced)}`}
          {sync.state === 'idle' && 'Waiting to sync'}
          {sync.state === 'error' && <Text style={{ color: colors.danger }}>Sync failed: {sync.error}</Text>}
        </Dim>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
          <Button title="Sync now" variant="ghost" onPress={() => void syncNow()} style={{ flex: 1, paddingVertical: 10 }} />
          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} style={{ flex: 1, paddingVertical: 10 }} />
        </View>
        <Button
          title="Delete account"
          variant="danger"
          style={{ marginTop: spacing.sm, paddingVertical: 10 }}
          onPress={() =>
            confirmAction({
              title: 'Delete your account?',
              message: 'This permanently deletes your account and all workouts stored in the cloud. This cannot be undone.',
              confirmLabel: 'Delete',
              destructive: true,
              onConfirm: async () => {
                const r = await deleteAccount();
                if (r.error) notify('Could not delete account', r.error);
              },
            })
          }
        />
      </Card>
    );
  }

  const submit = async () => {
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMsg({ text: 'Enter a valid email address.', error: true });
    if (password.length < 6) return setMsg({ text: 'Password must be at least 6 characters.', error: true });
    if (mode === 'signup') {
      const r = await signUp(email, password);
      if (r.error) setMsg({ text: r.error, error: true });
      else if (r.needsConfirm) setMsg({ text: 'Check your email and click the confirmation link, then sign in.' });
    } else {
      const r = await signIn(email, password);
      if (r.error) setMsg({ text: r.error, error: true });
    }
  };

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 2 }}>Account</Text>
      <Dim>Optional. Sign in to back up your workouts and use them on your phone and the web. Anything already logged on this device is kept.</Dim>

      <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
        <Chip label="Sign in" active={mode === 'signin'} onPress={() => setMode('signin')} />
        <Chip label="Create account" active={mode === 'signup'} onPress={() => setMode('signup')} />
      </View>

      <TextInput
        style={inputStyle}
        placeholder="Email"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={inputStyle}
        placeholder="Password (min 6 characters)"
        placeholderTextColor={colors.textDim}
        secureTextEntry
        autoCapitalize="none"
        textContentType={mode === 'signup' ? 'newPassword' : 'password'}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />

      {msg && <Text style={{ color: msg.error ? colors.danger : colors.accent, marginTop: 8 }}>{msg.text}</Text>}

      <Button
        title={busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        onPress={submit}
        style={{ marginTop: spacing.md }}
      />

      {(authProviders.google || (authProviders.apple && Platform.OS !== 'android')) && (
        <View style={{ marginTop: spacing.lg }}>
          <Dim style={{ textAlign: 'center', marginBottom: 8 }}>or continue with</Dim>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {authProviders.google && (
              <Button
                title="Google"
                variant="ghost"
                style={{ flex: 1, paddingVertical: 11 }}
                onPress={async () => {
                  const r = await signInWithOAuth('google');
                  if (r.error) setMsg({ text: r.error, error: true });
                }}
              />
            )}
            {authProviders.apple && Platform.OS !== 'android' && (
              <Button
                title="Apple"
                variant="ghost"
                style={{ flex: 1, paddingVertical: 11 }}
                onPress={async () => {
                  const r = await signInWithOAuth('apple');
                  if (r.error) setMsg({ text: r.error, error: true });
                }}
              />
            )}
          </View>
        </View>
      )}

      {mode === 'signin' && (
        <Pressable
          style={{ marginTop: spacing.md, alignItems: 'center' }}
          onPress={async () => {
            if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMsg({ text: 'Enter your email above first.', error: true });
            const r = await resetPassword(email);
            setMsg(r.error ? { text: r.error, error: true } : { text: 'Password reset email sent.' });
          }}
        >
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Forgot password?</Text>
        </Pressable>
      )}
    </Card>
  );
}
