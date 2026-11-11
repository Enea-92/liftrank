import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, Image, TextInput, KeyboardTypeOptions } from 'react-native';
import { colors, radius, spacing } from '../theme';

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const Button: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: ViewStyle;
}> = ({ title, onPress, variant = 'primary', style }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.btn,
      variant === 'primary' && { backgroundColor: colors.accent },
      variant === 'ghost' && { backgroundColor: colors.cardAlt },
      variant === 'danger' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
      pressed && { opacity: 0.8 },
      style,
    ]}
  >
    <Text
      style={[
        styles.btnText,
        variant === 'primary' && { color: colors.onAccent },
        variant === 'ghost' && { color: colors.text },
        variant === 'danger' && { color: colors.danger },
      ]}
    >
      {title}
    </Text>
  </Pressable>
);

export const Chip: React.FC<{ label: string; active?: boolean; onPress?: () => void }> = ({ label, active, onPress }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
    <Text style={{ color: active ? colors.onAccent : colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
  </Pressable>
);

export const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.title}>{children}</Text>
);

export const Dim: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <Text style={[{ color: colors.textDim, fontSize: 13 }, style]}>{children}</Text>
);

export const ProgressBar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
  <View style={styles.barBg}>
    <View style={[styles.barFill, { width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, backgroundColor: color }]} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '700', fontSize: 15 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: spacing.md },
  barBg: { height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});

// ---------------- extra building blocks ----------------

export const Field: React.FC<{
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  hint?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  maxLength?: number;
  multiline?: boolean;
}> = ({ label, value, onChangeText, placeholder, keyboardType, error, hint, autoCapitalize, maxLength, multiline }) => (
  <View style={{ marginBottom: spacing.md }}>
    <Text style={{ color: colors.textDim, fontSize: 13, marginBottom: 6 }}>{label}</Text>
    <TextInput
      style={{
        backgroundColor: colors.cardAlt,
        color: colors.text,
        borderRadius: radius.sm,
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 16,
        borderWidth: 1,
        borderColor: error ? colors.danger : 'transparent',
        minHeight: multiline ? 80 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textDim}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      autoCorrect={false}
      maxLength={maxLength}
      multiline={multiline}
    />
    {error ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text> : hint ? <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 4 }}>{hint}</Text> : null}
  </View>
);

export const Avatar: React.FC<{ uri?: string | null; name?: string; size?: number }> = ({ uri, name, size = 48 }) =>
  uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.cardAlt }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: size * 0.4 }}>
        {(name || '?').trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );

export const Stat: React.FC<{ label: string; value: string; style?: ViewStyle }> = ({ label, value, style }) => (
  <View style={[{ flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md }, style]}>
    <Text style={{ color: colors.textDim, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 }}>{value}</Text>
  </View>
);

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.sm }}>{children}</Text>
);

export const ChipRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>{children}</View>
);
