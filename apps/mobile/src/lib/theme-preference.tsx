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
    setForceLightState(value);
    setItem(KEY, value ? '1' : '0');
  }, []);

  const value = useMemo(() => ({ forceLight, setForceLight }), [forceLight, setForceLight]);

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceValue {
  return useContext(ThemePreferenceContext);
}
