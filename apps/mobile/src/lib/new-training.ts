import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * «Nuevo entrenamiento»: abre el formulario en blanco, sin crear nada todavía. El entrenamiento
 * se crea en cuanto se escribe un nombre (es obligatorio); si se sale sin él, no queda nada.
 */
export function useNewTraining() {
  const router = useRouter();
  return useCallback(async () => {
    router.push({ pathname: '/entrenamiento/[id]', params: { id: 'nuevo' } });
  }, [router]);
}

/** El id de la ruta con el que se abre el formulario de un entrenamiento que aún no existe. */
export const NEW_TRAINING_ID = 'nuevo';
