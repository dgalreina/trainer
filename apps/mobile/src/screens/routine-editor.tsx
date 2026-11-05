import { dayLabel, type UpdateRoutine } from '@trainer/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button, ErrorText } from '@/components/form';
import { RoutineForm } from '@/components/routine-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { useTrainings } from '@/lib/trainings';

/** Editar una rutina de un entrenamiento: nombre, ejercicios, series y descanso, todo en esta página. */
export function RoutineEditorScreen() {
  const { id, rid } = useLocalSearchParams<{ id: string; rid: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { trainings, loading, updateRoutine, removeRoutine } = useTrainings();
  const [error, setError] = useState<string | null>(null);

  const training = trainings.find((t) => t.id === id);
  const index = training?.routines.findIndex((r) => r.id === rid) ?? -1;
  const routine = index >= 0 ? training?.routines[index] : undefined;

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace({ pathname: '/entrenamiento/[id]', params: { id } });

  const onSave = useCallback(
    async (changes: UpdateRoutine) => {
      try {
        await updateRoutine(id, rid, changes);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se ha podido guardar');
        throw err;
      }
    },
    [updateRoutine, id, rid],
  );

  async function onDelete() {
    if (!routine) return;
    const ok = await confirmAction(
      'Borrar rutina',
      `Se borrará ${routine.name || dayLabel(index)} de este entrenamiento. Los entrenos ya registrados no se tocan.`,
      'Borrar',
    );
    if (!ok) return;
    try {
      await removeRoutine(id, routine.id);
      goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar');
    }
  }

  if (!training || !routine) {
    return (
      <Screen title="Rutina" stacked onBack={goBack}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText themeColor="textSecondary">No se ha encontrado esta rutina.</ThemedText>
        )}
      </Screen>
    );
  }

  return (
    <Screen title="Editar rutina" subtitle={`${dayLabel(index)} · ${training.name}`} stacked onBack={goBack}>
      <RoutineForm routine={routine} onSave={onSave} />
      <ErrorText message={error} />
      <Button variant="danger" title="Borrar rutina" onPress={onDelete} />
    </Screen>
  );
}
