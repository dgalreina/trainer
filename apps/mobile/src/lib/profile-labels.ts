import type { ActivityLevel, Goal, Sex } from '@trainer/shared';

export const SEX_LABELS: Record<Sex, string> = {
  mujer: 'Mujer',
  hombre: 'Hombre',
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; hint: string }> = {
  sedentario: { title: 'Sedentario', hint: 'Trabajo sentado y poco movimiento' },
  ligero: { title: 'Ligero', hint: 'Te mueves o entrenas 1-3 días a la semana' },
  moderado: { title: 'Moderado', hint: 'Entrenas o te mueves 3-5 días a la semana' },
  intenso: { title: 'Intenso', hint: 'Entrenas fuerte 6-7 días a la semana' },
  muy_intenso: { title: 'Muy intenso', hint: 'Trabajo físico o doble sesión diaria' },
};

export const GOAL_LABELS: Record<Goal, string> = {
  perder_grasa: 'Perder grasa',
  mantener: 'Mantener',
  ganar_musculo: 'Ganar músculo',
};
