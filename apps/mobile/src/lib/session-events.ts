import { useSyncExternalStore } from 'react';

// Aviso mínimo de "se ha guardado un entreno": el calendario de «Yo» está montado siempre
// (el paginador tiene todas las pestañas a la vez) y no se enteraría solo.
let version = 0;
const listeners = new Set<() => void>();

export function notifySessionSaved(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

/** Cambia cada vez que se guarda un entreno. Sirve como dependencia para recargar. */
export function useSessionsVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => 0,
  );
}
