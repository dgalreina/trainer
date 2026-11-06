import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ExerciseFrames } from '@/lib/exercise-images';

const HOLD_MS = 900;
const FADE_MS = 400;

/**
 * Ilustración de un ejercicio. Quieta (posición de inicio), o con `animate` recorriendo las
 * posiciones con fundidos suaves (ida y vuelta) para que se vea el movimiento.
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
  // `position` va de 0 a frames.length - 1: la imagen k se funde sobre las anteriores entre k-1 y k.
  const position = useRef(new Animated.Value(0)).current;
  const last = frames.length - 1;

  useEffect(() => {
    if (!animate) {
      position.setValue(0);
      return;
    }
    const step = (to: number) =>
      Animated.sequence([
        Animated.delay(HOLD_MS),
        Animated.timing(position, { toValue: to, duration: FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]);
    const path = [...Array.from({ length: last }, (_, i) => i + 1), ...Array.from({ length: last }, (_, i) => last - 1 - i)];
    const loop = Animated.loop(Animated.sequence(path.map(step)));
    loop.start();
    return () => loop.stop();
  }, [animate, position, last]);

  return (
    <View style={[styles.box, style]}>
      <Image source={frames[0]} style={styles.image} resizeMode="contain" />
      {animate &&
        frames.slice(1).map((frame, i) => (
          <Animated.Image
            key={i}
            source={frame}
            style={[styles.image, styles.top, { opacity: position.interpolate({ inputRange: [i, i + 1], outputRange: [0, 1], extrapolate: 'clamp' }) }]}
            resizeMode="contain"
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { aspectRatio: 1, width: '100%', overflow: 'hidden' },
  // Sin eventos, sin selección y sin el menú de iOS al mantener pulsado (copiar/guardar la imagen).
  image: { width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as object,
  top: { position: 'absolute', top: 0, left: 0 },
});
