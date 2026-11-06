import { createElement } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Campo de hora "HH:MM". En la web usa el selector de hora del propio navegador; en nativo,
 * por ahora, se escribe a mano.
 */
export function TimeField({
  label,
  value,
  onChange,
  background,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Fondo del campo cuando va sobre una tarjeta del mismo tono que el de por defecto. */
  background?: string;
}) {
  const theme = useTheme();
  const box = { backgroundColor: background ?? theme.backgroundElement, color: theme.text };

  return (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {Platform.OS === 'web' ? (
        createElement('input', {
          type: 'time',
          value,
          'aria-label': label,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: { ...webInput, backgroundColor: box.backgroundColor, color: box.color, colorScheme: 'inherit' },
        })
      ) : (
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          placeholder="HH:MM"
          placeholderTextColor={theme.textSecondary}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, box]}
        />
      )}
    </>
  );
}

const webInput = {
  border: 'none',
  outline: 'none',
  borderRadius: Radius.control,
  padding: `${Spacing.three - 2}px ${Spacing.three}px`,
  fontSize: 16,
  // La misma pila de fuentes que usa React Native Web para el resto del texto.
  fontFamily: 'System, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  minHeight: 48,
  boxSizing: 'border-box' as const,
  width: '100%',
};

const styles = StyleSheet.create({
  input: {
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
    fontSize: 16,
  },
});
