import { createElement } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Campo de fecha "AAAA-MM-DD". En la web usa el selector de fecha del propio navegador
 * (en el móvil abre el calendario del sistema); en nativo, por ahora, se escribe a mano.
 */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const box = { backgroundColor: theme.backgroundElement, color: theme.text };

  return (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {Platform.OS === 'web' ? (
        createElement('input', {
          type: 'date',
          value,
          'aria-label': label,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: {
            ...webInput,
            backgroundColor: box.backgroundColor,
            color: box.color,
            colorScheme: 'inherit',
          },
        })
      ) : (
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          placeholder="AAAA-MM-DD"
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
  // En iOS el selector de fecha tiene un ancho propio y se sale de la pantalla si no se le quita.
  display: 'block' as const,
  minWidth: 0,
  maxWidth: '100%',
  WebkitAppearance: 'none' as const,
  appearance: 'none' as const,
};

const styles = StyleSheet.create({
  input: {
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - 2,
    fontSize: 16,
  },
});
