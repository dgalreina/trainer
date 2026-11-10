/** Pestañas de la app, de izquierda a derecha. Fuente única para la barra y el paginador. */
export const TABS: readonly { key: string; path: string; label: string; noWaves?: boolean }[] = [
  { key: 'index', path: '/', label: 'Hoy' },
  // Sin ondas: suben fuera de la pantalla al entrar (la línea de tiempo ocupa toda la pantalla) y bajan al salir.
  { key: 'calendario', path: '/calendario', label: 'Calendario', noWaves: true },
  { key: 'entrenamientos', path: '/entrenamientos', label: 'Entrenos' },
  { key: 'dieta', path: '/dieta', label: 'Dietas' },
  { key: 'yo', path: '/yo', label: 'Yo' },
] as const;

/** Índice de la pestaña a la que corresponde la ruta, o -1 si no es una pestaña. */
export function tabIndexFromPath(pathname: string): number {
  const last = pathname.split('/').filter(Boolean).pop();
  if (last === undefined) return 0;
  return TABS.findIndex((tab) => tab.key === last);
}
