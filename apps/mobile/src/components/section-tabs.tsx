import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Botones para cambiar de sección dentro de una pestaña (van en `fixedTop` de `Screen`, fijos arriba). */
export function SectionTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Chip
          key={option.key}
          label={option.label}
          active={value === option.key}
          onPress={() => onChange(option.key)}
        />
      ))}
    </View>
  );
}

/** Lo que se ve en «Plantillas» mientras no las haya. */
export function TemplatesPlaceholder({ text }: { text: string }) {
  return (
    <ThemedText themeColor="textSecondary" style={styles.placeholder}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  placeholder: { textAlign: 'center', paddingTop: Spacing.four },
});
