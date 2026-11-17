import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ActionButton({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        primary ? { backgroundColor: theme.teal } : { borderColor: theme.sky, borderWidth: 1 },
        disabled && { opacity: 0.5 },
      ]}>
      <ThemedText type="smallBold" style={{ color: primary ? theme.onPrimary : theme.aiText, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
});
