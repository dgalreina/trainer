import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { TABS, tabIndexFromPath } from '@/lib/tabs';
import { CalendarScreen } from '@/screens/calendar';
import { DietScreen } from '@/screens/diet';
import { MeScreen } from '@/screens/me';
import { TodayScreen } from '@/screens/today';
import { TrainingsScreen } from '@/screens/trainings';

const PAGES = [TodayScreen, CalendarScreen, TrainingsScreen, DietScreen, MeScreen];

const SLIDE_MS = 380;
/** Cuánto se mueve el dedo en horizontal antes de que el gesto cuente como arrastre. */
const DRAG_START_PX = 12;
/** El arrastre solo vale si es claramente más horizontal que vertical: deja el scroll en paz. */
const HORIZONTAL_BIAS = 1.5;
/** Milisegundos de velocidad que se "proyectan" al soltar: un golpe rápido pasa de página. */
const FLICK_MS = 220;
/** En los extremos, la página se resiste: se mueve solo esta fracción del dedo. */
const EDGE_RESISTANCE = 0.25;

/**
 * Las cinco pestañas colocadas en fila y una al lado de la otra. Cambiar de pestaña
 * (tocando la barra o arrastrando el dedo) desplaza la fila: sale la de antes y entra la
 * nueva a la vez. Las ondas no forman parte de esto: están detrás y no se mueven.
 */
export function TabsPager() {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Las rutas que no son pestañas (el editor de rutinas, apilado encima) no mueven el paginador.
  const [index, setIndex] = useState(() => Math.max(tabIndexFromPath(pathname), 0));
  useEffect(() => {
    const next = tabIndexFromPath(pathname);
    if (next >= 0) setIndex(next);
  }, [pathname]);

  const offset = useSharedValue(-index * width);

  const slideTo = useCallback(
    (target: number) => {
      const to = -target * width;
      offset.value = reduceMotion
        ? to
        : withTiming(to, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
    },
    [offset, width, reduceMotion],
  );

  // Tocar una pestaña de la barra (o abrir una ruta) cambia el índice: se desliza hasta ahí.
  useEffect(() => {
    slideTo(index);
  }, [index, slideTo]);

  const responder = useMemo(() => {
    const last = TABS.length - 1;
    let startOffset = 0;
    let startDx = 0;

    // Cada gesto mueve como mucho una pestaña a cada lado de la actual, por fuerte que sea.
    const lowest = -Math.min(index + 1, last) * width;
    const highest = -Math.max(index - 1, 0) * width;
    const resist = (x: number) => {
      if (x > highest) return highest + (x - highest) * EDGE_RESISTANCE;
      if (x < lowest) return lowest + (x - lowest) * EDGE_RESISTANCE;
      return x;
    };

    const settle = (velocityX: number) => {
      const page = -offset.value / width;
      // vx va en px/ms: hacia la izquierda es negativa y avanza de página.
      const projected = page - (velocityX * FLICK_MS) / width;
      const next = Math.min(Math.max(Math.round(projected), index - 1, 0), index + 1, last);
      slideTo(next);
      if (next !== index) router.navigate(TABS[next].path);
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, g) =>
        Math.abs(g.dx) > DRAG_START_PX && Math.abs(g.dx) > Math.abs(g.dy) * HORIZONTAL_BIAS,
      onPanResponderGrant: (_event, g) => {
        cancelAnimation(offset);
        startOffset = offset.value;
        // El gesto se concede tras mover unos píxeles: se descuentan para que no dé un tirón.
        startDx = g.dx;
      },
      onPanResponderMove: (_event, g) => {
        offset.value = resist(startOffset + g.dx - startDx);
      },
      onPanResponderRelease: (_event, g) => settle(g.vx),
      onPanResponderTerminate: () => settle(0),
    });
  }, [offset, width, index, router, slideTo]);

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View style={styles.viewport} {...responder.panHandlers}>
      <Animated.View style={[styles.track, { width: width * PAGES.length }, track]}>
        {PAGES.map((Page, i) => (
          <View key={TABS[i].key} style={{ width }}>
            <Page />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // `touchAction: pan-y`: el navegador solo se encarga del scroll vertical y deja el horizontal
  // para el arrastre de pestañas (si no, lo toma como "volver atrás" o como scroll).
  viewport: { flex: 1, overflow: 'hidden', touchAction: 'pan-y' } as object,
  track: { flex: 1, flexDirection: 'row' },
});
