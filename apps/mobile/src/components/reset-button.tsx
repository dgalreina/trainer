import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const SIZE = 44;

/** Flecha circular hacia atrás («volver a empezar»): un icono en vez de texto. */
export function ResetButton({ onPress, label }: { onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={styles.hit}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <Path d="M3 3v5h5" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
