import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';
import { Waves, WAVES_HEIGHT } from '@/components/waves';
import { useSmoothValue } from '@/hooks/use-smooth-value';
import { TABS, tabIndexFromPath } from '@/lib/tabs';

/** Lo que tardan las ondas en subir o bajar: lo mismo que el deslizamiento de las pestañas. */
const WAVES_TRANSITION_MS = 380;

/**
 * Las ondas de la web. Son un componente aparte a propósito: su posición se anima a cada fotograma y, si el
 * estado viviera en el layout, cada fotograma volvería a pintar las cinco pestañas (y su contenido) mientras
 * se deslizan. Así solo se pinta esto. En las pestañas con `noWaves` suben fuera de la pantalla hasta
 * desaparecer; al ir a otra bajan de nuevo. Siempre con transición suave. Ocultas del todo, ni se pintan.
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
  // 0 = a la vista, 1 = subidas fuera de la pantalla.
  const hidden = useSmoothValue(TABS[tab].noWaves ? 1 : 0, WAVES_TRANSITION_MS);
  if (hidden >= 1) return null;
  return <Waves height={WAVES_HEIGHT} style={{ top: -WAVES_HEIGHT * hidden }} />;
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
