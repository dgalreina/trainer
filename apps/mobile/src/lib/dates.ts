const pad = (n: number) => String(n).padStart(2, '0');

/** Hoy como día de calendario "AAAA-MM-DD", en la hora del dispositivo. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "AAAA-MM-DD" → Date en hora local (a mediodía, para que ningún cambio de hora mueva el día). */
export function parseISO(iso: string): Date {
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

/** Un `Date` local como día de calendario "AAAA-MM-DD". */
export function isoOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Suma (o resta) días a un día de calendario. */
export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return isoOf(date);
}

/** El lunes de la semana de ese día (las semanas empiezan en lunes). */
export function mondayOf(iso: string): string {
  const weekday = (parseISO(iso).getDay() + 6) % 7; // lunes = 0 ... domingo = 6
  return addDays(iso, -weekday);
}

/** Las 00:00 de ese día, en la hora del dispositivo. */
export function startOfDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** "08:30". */
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "noviembre de 2026". */
export function formatMonthYear(iso: string): string {
  return parseISO(iso).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

/** "miércoles, 4 de noviembre". */
export function formatLongDay(iso: string): string {
  const text = parseISO(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
