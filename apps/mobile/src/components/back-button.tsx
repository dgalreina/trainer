import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Flecha de «atrás»: un chevrón dibujado con dos bordes, siempre centrado en su área táctil. */
export function BackButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Atrás"
      onPress={onPress}
      hitSlop={8}
      style={styles.hit}>
      <View style={[styles.chevron, { borderColor: theme.primaryText }]} />
    </Pressable>
  );
}

export const BACK_BUTTON_SIZE = 44;

const styles = StyleSheet.create({
  hit: { width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE, alignItems: 'center', justifyContent: 'center' },
  // Un cuadrado con solo los bordes izquierdo e inferior, girado 45°: apunta a la izquierda.
  // El desplazamiento a la derecha compensa que la punta ocupa solo la mitad izquierda del cuadrado girado.
  chevron: {
    width: 14,
    height: 14,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderRadius: 1.5,
    transform: [{ translateX: 5 }, { rotate: '45deg' }],
  },
});
