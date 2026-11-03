const pad = (n: number) => String(n).padStart(2, '0');

/** Hoy como día de calendario "AAAA-MM-DD", en la hora del dispositivo. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "AAAA-MM-DD" → Date en hora local (a mediodía, para que ningún cambio de hora mueva el día). */
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** "3 nov", o "3 nov 2027" si no es del año en curso. */
export function formatDay(iso: string): string {
  const date = parseISO(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function isValidISODate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = parseISO(text);
  return !Number.isNaN(date.getTime()) && todayLike(date) === text;
}

// Descarta fechas que JavaScript "corrige" en silencio (por ejemplo, 2026-02-31).
function todayLike(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
