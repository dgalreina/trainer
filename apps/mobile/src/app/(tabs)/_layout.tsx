import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';
import { Waves, WAVES_HEIGHT, WAVES_HEIGHT_COMPACT } from '@/components/waves';
import { useSmoothValue } from '@/hooks/use-smooth-value';
import { TABS, tabIndexFromPath } from '@/lib/tabs';

/** Lo que tarda la altura de las ondas en cambiar: lo mismo que el deslizamiento de las pestañas. */
const WAVES_TRANSITION_MS = 380;

/**
 * Las ondas de la web. Son un componente aparte a propósito: la altura se anima a cada fotograma y, si el
 * estado viviera en el layout, cada fotograma volvería a pintar las cinco pestañas (y su contenido) mientras
 * se deslizan. Así solo se pinta esto. En las pestañas con `compactWaves` suben hasta la altura del menú; al
 * ir a otra bajan de nuevo, y suben otra vez al volver. Siempre con transición suave.
 */
function TabsWaves() {
  const pathname = usePathname();
  // Una ruta que no es pestaña (un editor apilado encima) no cambia las ondas: se queda la última pestaña.
  const lastTab = useRef(Math.max(tabIndexFromPath(pathname), 0));
  const index = tabIndexFromPath(pathname);
  useEffect(() => {
    if (index >= 0) lastTab.current = index;
  }, [index]);
  const tab = index >= 0 ? index : lastTab.current;
  const height = useSmoothValue(TABS[tab].compactWaves ? WAVES_HEIGHT_COMPACT : WAVES_HEIGHT, WAVES_TRANSITION_MS);
  return <Waves height={height} />;
}

export default function TabsLayout() {
  // En iOS/Android las pestañas son nativas y sus pantallas opacas: cada pantalla
  // dibuja sus propias ondas.
  if (Platform.OS !== 'web') return <AppTabs />;

  // En la web las ondas viven aquí, detrás de todas las pestañas: no se mueven al cambiar
  // de pestaña (solo el contenido), aunque sí cambian de alto en las pestañas compactas.
  return (
    <ThemedView style={{ flex: 1 }}>
      <TabsWaves />
      <AppTabs />
    </ThemedView>
  );
}
