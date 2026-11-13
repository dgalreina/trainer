import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { COACH_EDGE, COACH_ICON, useCoachIconBottom } from '@/components/coach/coach-layout';
import { CoachOrb } from '@/components/coach/coach-orb';
import { useCoach } from '@/lib/coach';

/**
 * El icono del entrenador: flotante abajo a la derecha, por encima de todas las pantallas. En reposo está tranquilo
 * (respira muy despacio y sus ondas se deforman con suavidad); al pulsarlo se excita unos segundos y sale el bocadillo.
 * Pulsarlo con el bocadillo abierto lo cierra. Sube lo que pidan las pantallas con algo fijo abajo (`useCoachAvoid`).
 */
export function CoachButton() {
  const { open, setOpen, excited } = useCoach();
  const bottom = useCoachIconBottom();
  const reduced = useReducedMotion();
  const breath = useRef(new Animated.Value(0)).current;

  // Respiración lenta (escala de 1 a 1,05): solo con el bocadillo cerrado y si el usuario no pide menos movimiento.
  useEffect(() => {
    if (open || reduced) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [open, reduced, breath]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom, right: COACH_EDGE, transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Cerrar el chat con tu entrenador' : 'Hablar con tu entrenador'}
        onPress={() => setOpen(!open)}
        style={styles.button}>
        <CoachOrb size={COACH_ICON} excited={excited} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Por encima del bocadillo y de su fondo táctil (coach-chat.tsx).
  wrap: { position: 'absolute', width: COACH_ICON, height: COACH_ICON, zIndex: 50 },
  button: { width: COACH_ICON, height: COACH_ICON, borderRadius: COACH_ICON / 2 },
});
