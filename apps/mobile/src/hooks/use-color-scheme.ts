import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemePreference } from '@/lib/theme-preference';

/** Modo de la app: el del móvil, salvo que el usuario haya forzado el claro. */
export function useColorScheme() {
  const { forceLight } = useThemePreference();
  const system = useRNColorScheme();
  return forceLight ? 'light' : system;
}
