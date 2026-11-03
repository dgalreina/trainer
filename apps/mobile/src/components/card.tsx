import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  tone?: ThemeColor;
  style?: StyleProp<ViewStyle>;
}

/** Tarjeta suave, sin borde ni sombra. Si recibe `onPress`, es pulsable. */
export function Card({ children, onPress, tone = 'backgroundElement', style }: CardProps) {
  const body = (
    <ThemedView type={tone} style={[styles.card, style]}>
      {children}
    </ThemedView>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two },
  pressed: { opacity: 0.75 },
});
