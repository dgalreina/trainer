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

// --- El día del usuario. Por defecto empieza a las 00:00; con el ajuste «el día empieza a las…» (en minutos
// desde las 00:00, p. ej. 600 = 10:00) cada día va de esa hora a la misma del día siguiente: lo que se hace a
// las 02:00 cuenta en el día que empezó la tarde anterior.

/** Minutos desde las 00:00 de un "HH:MM". */
export function minutesOfTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** "HH:MM" de unos minutos desde las 00:00. */
export function timeOfMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** El momento en que empieza el día "AAAA-MM-DD" del usuario, en la hora del dispositivo. */
export function dayStart(iso: string, startMinutes: number): Date {
  const date = startOfDay(iso);
  date.setHours(Math.floor(startMinutes / 60), startMinutes % 60);
  return date;
}

/** A qué día del usuario ("AAAA-MM-DD") pertenece un momento. */
export function dayOf(date: Date, startMinutes: number): string {
  const shifted = new Date(date);
  shifted.setMinutes(shifted.getMinutes() - startMinutes);
  return isoOf(shifted);
}

/** El día del usuario en el que estamos ahora: de madrugada, aún es el que empezó ayer. */
export function currentDay(startMinutes: number): string {
  return dayOf(new Date(), startMinutes);
}

/** Un "HH:MM" dentro del día "AAAA-MM-DD" del usuario: antes de la hora de inicio, ya es de la madrugada siguiente. */
export function timeInDay(iso: string, time: string, startMinutes: number): Date {
  const [h, m] = time.split(':').map(Number);
  const date = startOfDay(minutesOfTime(time) < startMinutes ? addDays(iso, 1) : iso);
  date.setHours(h, m, 0, 0);
  return date;
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
