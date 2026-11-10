/** Pestañas de la app, de izquierda a derecha. Fuente única para la barra y el paginador. */
export const TABS: readonly { key: string; path: string; label: string; compactWaves?: boolean }[] = [
  { key: 'index', path: '/', label: 'Hoy' },
  // Las ondas de la cabecera suben hasta la altura del menú (la línea de tiempo ocupa toda la pantalla).
  { key: 'calendario', path: '/calendario', label: 'Calendario', compactWaves: true },
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
