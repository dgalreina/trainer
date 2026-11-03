import type { ExerciseCategory } from '@trainer/shared';

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  piernas: 'Piernas',
  core: 'Core',
  antebrazo: 'Antebrazo',
  funcional: 'Funcional',
  olimpicos: 'Olímpicos',
  otros: 'Otros',
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExerciseCategory[];
