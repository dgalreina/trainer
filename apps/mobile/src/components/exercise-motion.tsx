import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ExerciseFrames } from '@/lib/exercise-images';

const HOLD_MS = 900;
const FADE_MS = 400;

/**
 * Ilustración de un ejercicio. Quieta (posición de inicio), o con `animate` alternando las dos
 * posiciones con un fundido suave para que se vea el movimiento.
 */
export function ExerciseMotion({
  frames,
  animate,
  style,
}: {
  frames: ExerciseFrames;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      opacity.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(HOLD_MS),
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(HOLD_MS),
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, opacity]);

  return (
    <View style={[styles.box, style]}>
      <Image source={frames[0]} style={styles.image} resizeMode="contain" />
      {animate && (
        <Animated.Image source={frames[1]} style={[styles.image, styles.top, { opacity }]} resizeMode="contain" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { aspectRatio: 1, width: '100%', overflow: 'hidden' },
  // Sin eventos, sin selección y sin el menú de iOS al mantener pulsado (copiar/guardar la imagen).
  image: { width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as object,
  top: { position: 'absolute', top: 0, left: 0 },
});
