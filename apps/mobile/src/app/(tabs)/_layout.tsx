import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';
import { Waves, WAVES_HEIGHT } from '@/components/waves';
import { TABS, tabIndexFromPath } from '@/lib/tabs';

/** Lo que tardan las ondas en subir o bajar. Más lento que el deslizamiento de las pestañas: se nota como un gesto aparte. */
const WAVES_TRANSITION_MS = 750;

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
  const hide = Boolean(TABS[tab].noWaves);

  // El movimiento lo hace el navegador con una transición CSS de `transform` (en la tarjeta gráfica, sin
  // repintar nada a cada fotograma): un temporizador por fotograma competía con la animación de las propias
  // ondas y se veía a saltos. `shown` pasa a true un par de fotogramas después de montar para que al volver
  // se anime desde arriba; `mounted` deja de pintarlas del todo cuando ya están fuera.
  const [mounted, setMounted] = useState(!hide);
  const [shown, setShown] = useState(!hide);
  useEffect(() => {
    if (hide) {
      setShown(false);
      const timer = setTimeout(() => setMounted(false), WAVES_TRANSITION_MS + 60);
      return () => clearTimeout(timer);
    }
    setMounted(true);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [hide]);

  if (!mounted) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, left: 0, right: 0, height: WAVES_HEIGHT, transform: [{ translateY: shown ? 0 : -WAVES_HEIGHT }] },
        {
          transitionProperty: 'transform',
          transitionDuration: `${WAVES_TRANSITION_MS}ms`,
          transitionTimingFunction: 'cubic-bezier(0.45, 0, 0.2, 1)',
        } as object,
      ]}>
      <Waves height={WAVES_HEIGHT} />
    </View>
  );
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
