import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';

/** Tamaño del icono flotante y separación del borde de la pantalla. */
export const COACH_ICON = 60;
export const COACH_EDGE = Spacing.three;
/**
 * Lo que ocupa el icono por la derecha, desde el borde de la pantalla (px): lo que flota abajo (la tarjeta del calendario,
 * la barra de «Finalizar») deja libre esta columna, para que el icono quede a su lado y no encima.
 */
export const COACH_COLUMN = COACH_EDGE + COACH_ICON + Spacing.three;
/** Hueco entre el icono y el bocadillo. */
export const COACH_BUBBLE_GAP = 10;

/**
 * Distancia (px) del borde de abajo al icono: la zona segura y la barra de pestañas (solo en nativo: en la web va arriba).
 * Es siempre la misma, en todas las pantallas: el icono no se mueve.
 */
export function useCoachIconBottom(): number {
  const insets = useSafeAreaInsets();
  return COACH_EDGE + insets.bottom + (Platform.OS === 'web' ? 0 : BottomTabInset);
}

/**
 * Lo que tapa el teclado por abajo (px; 0 si no hay). En la web de iOS el teclado no reduce la página, solo la «vista
 * visual», así que se mide la diferencia; en nativo, con los eventos del teclado.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (Platform.OS === 'web') {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const update = () => setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
      update();
      viewport.addEventListener('resize', update);
      viewport.addEventListener('scroll', update);
      return () => {
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
        setInset(0);
      };
    }
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setInset(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
      setInset(0);
    };
  }, [active]);
  return inset;
}
