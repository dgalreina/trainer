import { exerciseNameKey, type Exercise } from '@trainer/shared';
import { useState } from 'react';
import { useRouter } from 'expo-router';

import { ExerciseBrowser } from '@/components/exercise-picker';
import { Button, ErrorText } from '@/components/form';
import { Screen } from '@/components/screen';
import { useExercises } from '@/lib/exercises';

/** `stacked`: abierto encima de las pestañas (con botón Atrás), no como una de ellas. */
export function ExercisesScreen({ stacked }: { stacked?: boolean }) {
  const router = useRouter();
  const { exercises, error: loadError, create, archive } = useExercises();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(name: string) {
    setCreating(true);
    setError(null);
    try {
      await create(name, 'otros');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido crear el ejercicio');
    } finally {
      setCreating(false);
    }
  }

  async function onRemove(exercise: Exercise) {
    setError(null);
    try {
      await archive(exercise);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar');
    }
  }

  return (
    <Screen
      title="Ejercicios"
      scroll={false}
      stacked={stacked}
      onBack={stacked ? () => (router.canGoBack() ? router.back() : router.replace('/yo')) : undefined}>
      <ExerciseBrowser
        placeholder="Buscar o crear un ejercicio…"
        onRemove={onRemove}
        extra={(query) => {
          const key = exerciseNameKey(query);
          // Misma comparación que el servidor: si ya existe, no se ofrece crearlo.
          const canCreate = key.length > 0 && !exercises.some((e) => exerciseNameKey(e.name) === key);
          return (
            <>
              {canCreate && <Button title={`Crear «${query.trim()}» en Otros`} onPress={() => onCreate(query.trim())} loading={creating} />}
              <ErrorText message={error ?? loadError} />
            </>
          );
        }}
      />
    </Screen>
  );
}
