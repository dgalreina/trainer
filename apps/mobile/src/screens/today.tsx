import { dayLabel, routineTitle } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TrainingBadge } from '@/components/training-badge';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useExercises } from '@/lib/exercises';
import { routineSummary } from '@/lib/routine-summary';
import { useSettings } from '@/lib/settings';
import { useTrainings } from '@/lib/trainings';

export function TodayScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { trainings, loading, error } = useTrainings();
  const { activeTraining } = useSettings();
  const { byId } = useExercises();

  const openWorkout = (trainingId: string, routineId: string) =>
    router.push({ pathname: '/entreno/[id]/[rid]', params: { id: trainingId, rid: routineId } });

  const newRoutine = (trainingId: string) =>
    router.push({
      pathname: '/entrenamiento/[id]/rutina/[rid]',
      params: { id: trainingId, rid: 'nueva' },
    });

  return (
    <Screen
      title="Hoy"
      action={
        activeTraining ? (
          <TrainingBadge
            training={activeTraining}
            onPress={() =>
              router.push({ pathname: '/entrenamiento/[id]', params: { id: activeTraining.id } })
            }
          />
        ) : undefined
      }>
      <ErrorText message={error} />

      {loading && trainings.length === 0 ? (
        <ActivityIndicator color={theme.primary} />
      ) : !activeTraining ? (
        <Card tone="primarySoft" style={styles.empty}>
          <ThemedText type="smallBold">
            {trainings.length === 0 ? 'Aún no tienes entrenamiento' : 'No hay un entrenamiento actual'}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            {trainings.length === 0
              ? 'Pronto podrás hablar con tu entrenador y te preparará uno según lo que necesites. Mientras tanto, puedes crear el tuyo a mano.'
              : 'Elige cuál estás haciendo ahora para verlo aquí.'}
          </ThemedText>
          <Button
            title={trainings.length === 0 ? 'Crear un entrenamiento' : 'Elegir entrenamiento'}
            onPress={() =>
              trainings.length === 0
                ? router.push('/entrenamiento/nuevo')
                : router.navigate('/entrenamientos')
            }
          />
        </Card>
      ) : (
        <>
          {activeTraining.routines.length === 0 ? (
            <Card style={styles.empty}>
              <ThemedText themeColor="textSecondary">
                Este entrenamiento aún no tiene rutinas. Añade una por cada día de entreno.
              </ThemedText>
              <Button
                title="Añadir rutina"
                onPress={() => newRoutine(activeTraining.id)}
              />
            </Card>
          ) : (
            <>
              <ThemedText type="smallBold">¿Qué entrenas hoy?</ThemedText>
              {activeTraining.routines.map((routine, index) => {
                const summary = routineSummary(routine, byId);
                return (
                  <Card
                    key={routine.id}
                    onPress={() => openWorkout(activeTraining.id, routine.id)}
                    style={styles.routine}>
                    {routine.name ? (
                      <ThemedText type="small" themeColor="primaryText">
                        {dayLabel(index)}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="subtitle" style={styles.routineName}>
                      {routineTitle(activeTraining.routines, routine.id)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {summary.counts}
                    </ThemedText>
                    {summary.preview ? <ThemedText type="small">{summary.preview}</ThemedText> : null}
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { gap: Spacing.three, padding: Spacing.four },
  routine: { gap: Spacing.one, paddingVertical: Spacing.four },
  routineName: { fontSize: 26, lineHeight: 32 },
});
