import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { OptionRow } from '@/components/option-rows';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Desplegable: cerrado es un campo con la opción elegida y una flecha; al tocarlo se abre la lista debajo (con la
 * ayuda de cada opción) y al elegir una se cierra. Ocupa poco cuando está cerrado, a diferencia de `OptionRows`.
 */
export function SelectField<T extends string>({
  options,
  selected,
  onSelect,
  placeholder = 'Elegir…',
  accessibilityLabel,
}: {
  options: OptionRow<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  placeholder?: string;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === selected);

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={[styles.value, !current && { color: theme.textSecondary }]}>
          {current ? current.title : placeholder}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.arrow}>
          {open ? '▴' : '▾'}
        </ThemedText>
      </Pressable>

      {open && (
        <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
          {options.map((option) => {
            const active = option.value === selected;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                style={[styles.option, active && { backgroundColor: theme.primarySoft }]}>
                <View style={styles.text}>
                  <ThemedText type="smallBold">{option.title}</ThemedText>
                  {option.hint ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {option.hint}
                    </ThemedText>
                  ) : null}
                </View>
                {active && (
                  <ThemedText type="smallBold" themeColor="primaryText">
                    ✓
                  </ThemedText>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.one },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  value: { flex: 1 },
  arrow: { fontSize: 16 },
  list: { borderRadius: Radius.control, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  text: { flex: 1, gap: Spacing.half },
});
