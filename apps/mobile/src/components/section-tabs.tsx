import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Botones para cambiar de sección dentro de una pestaña (van en `fixedTop` de `Screen`, fijos arriba), centrados y sin scroll.
 * `extra` es una segunda fila debajo, para lo que solo ve algún usuario (Admin en Yo) y no debe apretar la primera.
 */
export function SectionTabs<T extends string>({
  options,
  extra = [],
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  extra?: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const row = (list: { key: T; label: string }[]) => (
    <View style={styles.row}>
      {list.map((option) => (
        <Chip compact key={option.key} label={option.label} active={value === option.key} onPress={() => onChange(option.key)} />
      ))}
    </View>
  );
  return (
    <View style={styles.rows}>
      {row(options)}
      {extra.length > 0 ? row(extra) : null}
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
  rows: { gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.one + 2 },
  placeholder: { textAlign: 'center', paddingTop: Spacing.four },
});
