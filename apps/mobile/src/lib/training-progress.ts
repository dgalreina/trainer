import type { Training, TrainingProgress } from '@trainer/shared';

import { formatDay } from '@/lib/dates';

/** "Semana 2 de 8", "Empieza el 10 nov" o "Terminado el 28 dic". */
export function progressLabel(training: Training, progress: TrainingProgress): string {
  if (progress.status === 'upcoming') return `Empieza el ${formatDay(training.startDate)}`;
  if (progress.status === 'finished') return `Terminado el ${formatDay(progress.endDate)}`;
  return `Semana ${progress.week} de ${progress.totalWeeks}`;
}

/** Versión corta para espacios pequeños (el círculo de Hoy). */
export function progressShort(training: Training, progress: TrainingProgress): string {
  if (progress.status === 'upcoming') return `Empieza ${formatDay(training.startDate)}`;
  if (progress.status === 'finished') return 'Terminado';
  return `Semana ${progress.week}/${progress.totalWeeks}`;
}
