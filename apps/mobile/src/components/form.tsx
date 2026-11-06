import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const theme = useTheme();
  return (
    <>
      {label ? (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        {...props}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text },
          style,
        ]}
      />
    </>
  );
}

/** Campo numérico compacto para pesos y repeticiones. Trabaja con texto: el padre decide cómo interpretarlo. */
export function NumberInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  compact,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel: string;
  /** Estrecho (una columna de serie): varias caben en una fila. */
  compact?: boolean;
}) {
  const theme = useTheme();
  // El texto de ayuda («kg», «reps») se quita en cuanto se pincha el campo.
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={focused ? '' : placeholder}
      placeholderTextColor={theme.textSecondary}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={[styles.number, compact && styles.numberCompact, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
    />
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const theme = useTheme();
  const background =
    variant === 'primary' ? theme.primary : variant === 'danger' ? theme.dangerSoft : theme.backgroundElement;
  const foreground =
    variant === 'primary' ? theme.onPrimary : variant === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        (pressed || disabled) && styles.dim,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <ThemedText type="smallBold" style={{ color: foreground }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function LinkButton({
  title,
  onPress,
  centered,
}: {
  title: string;
  onPress: () => void;
  /** Centrado en su fila; por defecto va a la izquierda. */
  centered?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={centered ? { alignSelf: 'center' } : undefined}>
      <ThemedText type="linkPrimary">{title}</ThemedText>
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <ThemedText type="small" style={{ color: theme.danger }}>
      {message}
    </ThemedText>
  );
}

/** Pastilla pulsable: filtros y opciones activables. */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundSelected }]}>
      <ThemedText type="small" style={{ color: active ? theme.onPrimary : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
    fontSize: 16,
  },
  numberCompact: { width: 56, minWidth: 0 },
  number: {
    borderRadius: Radius.control,
    minWidth: 64,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    borderRadius: Radius.control,
    paddingVertical: Spacing.three - 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  dim: { opacity: 0.6 },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
