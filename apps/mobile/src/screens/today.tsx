import { dayLabel, doneRoutineIds, routineTitle, type WorkoutSession } from '@trainer/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText, LinkButton } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TrainingBadge } from '@/components/training-badge';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { startOfDay } from '@/lib/dates';
import { useExercises } from '@/lib/exercises';
import { useNewTraining } from '@/lib/new-training';
import { routineSummary } from '@/lib/routine-summary';
import { useSessionsVersion } from '@/lib/session-events';
import { useSettings } from '@/lib/settings';
import { getItem } from '@/lib/storage';
import { useTrainings } from '@/lib/trainings';
import { draftKey, parseDraft } from '@/lib/workout-draft';

export function TodayScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { trainings, loading, error, refresh } = useTrainings();
  // Al entrar se vuelve a pedir al servidor: el entrenamiento pudo cambiar desde otro sitio.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  const newTraining = useNewTraining();
  const { activeTraining, settings, resetRoutines } = useSettings();

  // Rutinas con el entreno empezado y sin finalizar: viven como borrador en el dispositivo. Se vuelve a mirar cada
  // vez que se entra en la pestaña (también al volver atrás desde el entreno).
  const [inProgress, setInProgress] = useState<Set<string>>(new Set());
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const started = new Set<string>();
        for (const routine of activeTraining?.routines ?? []) {
          const draft = parseDraft(await getItem(draftKey(activeTraining!.id, routine.id)));
          if (draft && draft.startedAt !== null) started.add(routine.id);
        }
        if (!cancelled) setInProgress(started);
      })();
      return () => {
        cancelled = true;
      };
    }, [activeTraining]),
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const { byId } = useExercises();

  // Rutinas hechas en el ciclo en curso (ver `doneRoutineIds`): salen de los entrenos terminados del entrenamiento actual.
  // Se vuelven a pedir al entrar y cuando se guarda, edita o borra un entreno.
  const sessionsVersion = useSessionsVersion();
  const [done, setDone] = useState<Set<string>>(new Set());
  const resetAt = settings.routinesResetAt;
  useFocusEffect(
    useCallback(() => {
      if (!activeTraining || activeTraining.routines.length === 0) {
        setDone(new Set());
        return;
      }
      let cancelled = false;
      // Un entreno empezado antes del reinicio y terminado después también cuenta: se piden desde un día antes.
      const from = resetAt
        ? new Date(Date.parse(resetAt) - 24 * 3_600_000).toISOString()
        : startOfDay(activeTraining.startDate).toISOString();
      api
        .get<WorkoutSession[]>(`/sessions?limit=100&from=${encodeURIComponent(from)}`)
        .then((sessions) => {
          if (cancelled) return;
          const mine = sessions.filter((s) => s.trainingId === activeTraining.id);
          setDone(doneRoutineIds(activeTraining.routines.map((r) => r.id), mine, resetAt));
        })
        // Sin conexión se dejan las marcas que había: no se desmarca nada por un fallo de red.
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [activeTraining, resetAt, sessionsVersion]),
  );

  const openWorkout = (trainingId: string, routineId: string) =>
    router.push({ pathname: '/entreno/[id]/[rid]', params: { id: trainingId, rid: routineId } });

  const newRoutine = (trainingId: string) =>
    router.push({
      pathname: '/entrenamiento/[id]',
      params: { id: trainingId },
    });

  return (
    <Screen
      title="¿Qué vas a entrenar hoy?"
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
      <ErrorText message={error ?? createError} />

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
                ? newTraining().then(
                    () => setCreateError(null),
                    (err) => setCreateError(err instanceof Error ? err.message : 'No se ha podido crear'),
                  )
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
              {activeTraining.routines.map((routine, index) => {
                const summary = routineSummary(routine, byId);
                const started = inProgress.has(routine.id);
                const isDone = !started && done.has(routine.id);
                return (
                  <Card
                    key={routine.id}
                    onPress={() => openWorkout(activeTraining.id, routine.id)}
                    style={[styles.routine, isDone && styles.done]}>
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
                    {started ? (
                      <ThemedText type="smallBold" themeColor="primaryText" style={styles.tag}>
                        En curso
                      </ThemedText>
                    ) : isDone ? (
                      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.tag}>
                        Hecha
                      </ThemedText>
                    ) : null}
                  </Card>
                );
              })}
              {/* Abajo a la derecha y solo si hay algo marcado que descartar. */}
              {done.size > 0 ? (
                <View style={styles.resetRow}>
                  <LinkButton title="Descartar todo" onPress={() => resetRoutines().then(() => setDone(new Set()), () => {})} />
                </View>
              ) : null}
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
  // Arriba a la derecha de la tarjeta, a la altura de «Día N».
  tag: { position: 'absolute', top: Spacing.four, right: Spacing.three },
  // Una rutina ya hecha en este ciclo se ve más tenue; se puede volver a elegir.
  done: { opacity: 0.55 },
  resetRow: { alignItems: 'flex-end' },
  routineName: { fontSize: 26, lineHeight: 32 },
});
