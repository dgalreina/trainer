import { dayLabel, doneRoutineIds, type Routine, type WorkoutSession } from '@trainer/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { LiveDot } from '@/components/live-dot';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TrainingBadge } from '@/components/training-badge';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { startOfDay } from '@/lib/dates';
import { confirmAction } from '@/lib/confirm';
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
  // Todas las rutinas hechas: se avisa, pero los tics no se quitan solos.
  const allDone = !!activeTraining && activeTraining.routines.length > 0 && done.size === activeTraining.routines.length;
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
      compactTitle
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
              {/* Arriba, las rutinas libres (sin «Día N»: no hay un orden fijo); abajo, las ya hechas esta semana, más tenues, y
                  numeradas «Día 1, 2, 3…» en el orden en que se entrenaron (sale de los entrenos guardados, como el calendario). */}
              {(() => {
                const byRoutineId = new Map(activeTraining.routines.map((r) => [r.id, r]));
                // En curso primero; el resto, en el orden del entrenamiento.
                const free = [
                  ...activeTraining.routines.filter((r) => inProgress.has(r.id)),
                  ...activeTraining.routines.filter((r) => !inProgress.has(r.id) && !done.has(r.id)),
                ];
                // `done` conserva el orden en que se hizo cada una por primera vez.
                const doneList = [...done].flatMap((id) => (byRoutineId.has(id) && !inProgress.has(id) ? [byRoutineId.get(id)!] : []));
                const card = (routine: Routine, dayNumber: number | null) => {
                  const summary = routineSummary(routine, byId);
                  const started = inProgress.has(routine.id);
                  // Sin nombre, se muestran los primeros ejercicios: no hay «Día N» al que agarrarse.
                  const title = routine.name || summary.preview || 'Rutina sin ejercicios';
                  return (
                    <Card
                      key={routine.id}
                      onPress={() => openWorkout(activeTraining.id, routine.id)}
                      style={[styles.routine, dayNumber !== null && styles.done]}>
                      {dayNumber !== null ? (
                        <ThemedText type="small" themeColor="primaryText">
                          {dayLabel(dayNumber)}
                        </ThemedText>
                      ) : null}
                      <ThemedText type="subtitle" style={routine.name ? styles.routineName : styles.routineNameLong} numberOfLines={2}>
                        {title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {summary.counts}
                      </ThemedText>
                      {started ? (
                        <View style={styles.tag}>
                          <LiveDot />
                        </View>
                      ) : null}
                    </Card>
                  );
                };
                return (
                  <>
                    {free.length > 0 && doneList.length > 0 ? (
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        Disponibles
                      </ThemedText>
                    ) : null}
                    {free.map((routine) => card(routine, null))}
                    {doneList.length > 0 ? (
                      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
                        Hechas esta semana
                      </ThemedText>
                    ) : null}
                    {doneList.map((routine, i) => card(routine, i))}
                  </>
                );
              })()}
              {/* Los tics solo se quitan aquí, cuando el usuario decide. Sin tics no procede: el botón sale apagado. */}
              <View style={styles.newWeek}>
                {allDone ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.newWeekText}>
                    Ya has hecho todas las rutinas. ¿Quieres empezar una nueva semana?
                  </ThemedText>
                ) : null}
                <Button
                  title="Nueva semana"
                  variant={allDone ? 'primary' : 'secondary'}
                  disabled={done.size === 0}
                  onPress={async () => {
                    const ok = await confirmAction(
                      'Nueva semana',
                      'Se quitarán los tics de todas las rutinas y empezarás una semana nueva. No se borra ningún entreno.',
                      'Empezar',
                    );
                    if (ok) resetRoutines().then(() => setDone(new Set()), () => {});
                  }}
                />
              </View>
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
  // Arriba a la derecha de la tarjeta.
  tag: { position: 'absolute', top: Spacing.four, right: Spacing.three },
  // Una rutina ya hecha en este ciclo se ve más tenue; se puede volver a elegir.
  done: { opacity: 0.55 },
  newWeek: { gap: Spacing.two, marginTop: Spacing.two },
  newWeekText: { textAlign: 'center' },
  routineName: { fontSize: 26, lineHeight: 32 },
  // Una rutina sin nombre muestra sus primeros ejercicios: más pequeño para que quepa.
  routineNameLong: { fontSize: 20, lineHeight: 26 },
  groupTitle: { marginTop: Spacing.two },
});
