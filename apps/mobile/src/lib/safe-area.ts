import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Lee en px lo que vale `env(safe-area-inset-top)` ahora mismo (solo en la web). */
function readSafeTop(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return Math.round(px);
}

/**
 * En la PWA de iOS con la barra de estado translúcida, el alto de la página (`innerHeight`, `100%`, `100vh`) sale más corto
 * que la pantalla —justo el hueco de la hora— y abajo queda una franja blanca. Se ajusta la raíz al alto real de la pantalla
 * (`screen.height`) cuando la app está instalada y en vertical. Solo en la web.
 */
export function useFullScreenHeight(): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fit = () => {
      const root = document.getElementById('root');
      if (!root) return;
      const standalone =
        (navigator as unknown as { standalone?: boolean }).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
      const portrait = window.innerHeight > window.innerWidth;
      // El teclado no cambia `innerHeight` en iOS (solo la vista visual), así que no estorba.
      root.style.height = standalone && portrait ? `${Math.max(window.innerHeight, window.screen.height)}px` : '';
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, []);
}

/**
 * Lo que hay que dejar libre arriba (px) para no pisar la hora y la batería. En la PWA de iOS la web ocupa toda la pantalla
 * (barra de estado translúcida + `viewport-fit=cover`), y el margen lo da `env(safe-area-inset-top)`. Se lee directamente
 * del CSS porque `react-native-safe-area-context` en la web devolvía 0 aquí. En nativo no hace falta: 0.
 */
export function useSafeTop(): number {
  const [top, setTop] = useState(() => (Platform.OS === 'web' && typeof document !== 'undefined' ? readSafeTop() : 0));
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setTop(readSafeTop());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return top;
}
