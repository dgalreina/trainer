import { ScrollView, StyleSheet } from 'react-native';

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
  // Si no caben todos (Yo con «Admin»), la fila se desplaza de lado; si caben, quedan centrados.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {options.map((option) => (
        <Chip
          key={option.key}
          label={option.label}
          active={value === option.key}
          onPress={() => onChange(option.key)}
        />
      ))}
    </ScrollView>
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
  // La fila llega hasta los bordes de la pantalla (se sale del margen de la página) para que se vea que sigue al deslizar.
  scroll: { marginHorizontal: -Spacing.four },
  row: { flexGrow: 1, paddingHorizontal: Spacing.four, flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  placeholder: { textAlign: 'center', paddingTop: Spacing.four },
});
