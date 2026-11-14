import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const BOX = 22;
const DOT = 10;

/**
 * Un punto que late («en curso»): un punto de acento y, detrás, un anillo que se expande y se desvanece, como un
 * indicador «en directo». Con «reducir movimiento» se queda quieto.
 */
export function LiveDot() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    // De 0 a 1 una y otra vez (sin ir y volver): cada vuelta es un latido.
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.value),
    transform: [{ scale: 1 + 1.2 * pulse.value }],
  }));

  return (
    <View style={styles.box} accessible accessibilityLabel="En curso">
      {reduced ? null : <Animated.View style={[styles.dot, styles.ring, { backgroundColor: theme.primaryText }, ring]} />}
      <View style={[styles.dot, { backgroundColor: theme.primaryText }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  ring: { position: 'absolute' },
});
