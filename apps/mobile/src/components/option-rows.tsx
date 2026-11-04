import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface OptionRow<T extends string> {
  value: T;
  title: string;
  hint?: string;
}

/** Lista de opciones con una elegida (se puede volver a tocar para quitarla). */
export function OptionRows<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: OptionRow<T>[];
  selected: T | null;
  onSelect: (value: T | null) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.list}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(active ? null : option.value)}
            style={[
              styles.row,
              { backgroundColor: active ? theme.primarySoft : theme.backgroundElement },
              active && { borderColor: theme.primary },
            ]}>
            <View style={styles.text}>
              <ThemedText type="smallBold">{option.title}</ThemedText>
              {option.hint ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {option.hint}
                </ThemedText>
              ) : null}
            </View>
            <View style={[styles.radio, { borderColor: active ? theme.primary : theme.backgroundSelected }]}>
              {active && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  text: { flex: 1, gap: Spacing.half },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
