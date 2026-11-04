/** Pestañas de la app, de izquierda a derecha. Fuente única para la barra y el paginador. */
export const TABS = [
  { key: 'index', path: '/', label: 'Hoy' },
  { key: 'calendario', path: '/calendario', label: 'Calendario' },
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
