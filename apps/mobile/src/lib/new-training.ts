import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { todayISO } from '@/lib/dates';
import { useTrainings } from '@/lib/trainings';

const NEW_TRAINING_NAME = 'Nuevo entrenamiento';
const NEW_TRAINING_WEEKS = 8;

/**
 * «Nuevo entrenamiento»: se crea al momento, con valores por defecto, y se abre su pantalla de
 * edición, la misma que la de cualquier otro (se guarda sola y se le añaden rutinas con +).
 */
export function useNewTraining() {
  const router = useRouter();
  const { create } = useTrainings();
  return useCallback(async () => {
    const created = await create({
      name: NEW_TRAINING_NAME,
      startDate: todayISO(),
      durationWeeks: NEW_TRAINING_WEEKS,
    });
    router.push({ pathname: '/entrenamiento/[id]', params: { id: created.id } });
  }, [create, router]);
}
