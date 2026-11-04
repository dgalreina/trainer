import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';

import { getItem, setItem } from '@/lib/storage';

const KEY = 'trainer.forceLight';

interface ThemePreferenceValue {
  /** true: siempre claro. false: lo decide el móvil. */
  forceLight: boolean;
  setForceLight: (value: boolean) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceValue>({
  forceLight: false,
  setForceLight: () => {},
});

// En la web localStorage es síncrono: se lee ya en el primer render para que quien
// fuerza el modo claro en un móvil oscuro no vea un destello oscuro al abrir.
function readInitial(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [forceLight, setForceLightState] = useState(readInitial);

  // En el móvil el llavero es asíncrono: se recupera al arrancar.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    getItem(KEY).then((saved) => setForceLightState(saved === '1'));
  }, []);

  // En iOS/Android esto cambia también lo que pinta el sistema (barra de estado,
  // pestañas nativas). 'unspecified' devuelve el control al modo del móvil.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(forceLight ? 'light' : 'unspecified');
  }, [forceLight]);

  const setForceLight = useCallback((value: boolean) => {
    setItem(KEY, value ? '1' : '0');
    // En la web, el cambio se funde con una transición de vista del navegador: foto de la pantalla
    // antes y después, mezcladas con un solo fundido. Es mucho más uniforme que animar los colores
    // uno a uno (los textos iban más lentos que el fondo). Si el navegador no la tiene, o se pide
    // reducir el movimiento, queda el método de clases CSS de `_layout.tsx` o el cambio directo.
    if (Platform.OS === 'web') {
      const doc = globalThis.document as
        | (Document & { startViewTransition?: (update: () => void) => { finished: Promise<unknown> } })
        | undefined;
      const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (doc?.startViewTransition && !reduceMotion) {
        const root = doc.documentElement;
        root.setAttribute('data-view-transition', '');
        // `flushSync`: el DOM debe estar ya con los colores nuevos cuando acaba la función, que es
        // cuando el navegador hace la segunda foto.
        const { flushSync } = require('react-dom') as { flushSync: (update: () => void) => void };
        doc
          .startViewTransition(() => flushSync(() => setForceLightState(value)))
          .finished.finally(() => root.removeAttribute('data-view-transition'));
        return;
      }
    }
    setForceLightState(value);
  }, []);

  const value = useMemo(() => ({ forceLight, setForceLight }), [forceLight, setForceLight]);

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceValue {
  return useContext(ThemePreferenceContext);
}
