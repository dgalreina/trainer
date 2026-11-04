import {
  DEFAULT_REST_SECONDS,
  MAX_TRAINING_WEEKS,
  REST_SECONDS_OPTIONS,
  trainingProgress,
  type Training,
} from '@trainer/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { Button, Chip, ErrorText, Field, LinkButton, NumberInput } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { formatDay, isValidISODate, todayISO } from '@/lib/dates';
import { useExercises } from '@/lib/exercises';
import { routineSummary } from '@/lib/routine-summary';
import { useSettings } from '@/lib/settings';
import { useTrainings } from '@/lib/trainings';

const DEFAULT_WEEKS = 8;

/** Entrenamiento: sus datos (nombre, inicio, semanas) y las rutinas que lleva dentro. */
export function TrainingEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { trainings, loading, create, update, remove } = useTrainings();
  const { settings, setActiveTraining } = useSettings();
  const { byId } = useExercises();

  const isNew = id === 'nuevo';
  const existing = isNew ? undefined : trainings.find((t) => t.id === id);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [weeks, setWeeks] = useState(String(DEFAULT_WEEKS));
  const [restSeconds, setRestSeconds] = useState<number>(DEFAULT_REST_SECONDS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El formulario se rellena una sola vez, cuando el entrenamiento está disponible.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !existing) return;
    initialized.current = true;
    setName(existing.name);
    setStartDate(existing.startDate);
    setWeeks(String(existing.durationWeeks));
    setRestSeconds(existing.restSeconds);
  }, [existing]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/entrenamientos'));
  const back = <LinkButton title="Atrás" onPress={goBack} />;

  const weeksNumber = Number.parseInt(weeks, 10);
  const datesValid = isValidISODate(startDate) && weeksNumber >= 1 && weeksNumber <= MAX_TRAINING_WEEKS;
  const preview = datesValid
    ? trainingProgress({ startDate, durationWeeks: weeksNumber }, todayISO())
    : null;

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) return setError('Ponle un nombre al entrenamiento');
    if (!isValidISODate(startDate)) return setError('Elige una fecha de inicio válida');
    if (!(weeksNumber >= 1 && weeksNumber <= MAX_TRAINING_WEEKS)) {
      return setError(`La duración va de 1 a ${MAX_TRAINING_WEEKS} semanas`);
    }

    setSaving(true);
    setError(null);
    try {
      const data = { name: trimmed, startDate, durationWeeks: weeksNumber, restSeconds };
      if (isNew) {
        const created = await create(data);
        // Recién creado está vacío: se pasa a su página para añadirle rutinas.
        router.replace({ pathname: '/entrenamiento/[id]', params: { id: created.id } });
      } else {
        await update(id, data);
        goBack();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmAction(
      'Borrar entrenamiento',
      `Se borrará «${existing.name}» con sus ${existing.routines.length} rutinas. Los entrenos ya registrados no se tocan.`,
      'Borrar',
    );
    if (!ok) return;
    try {
      await remove(existing.id);
      goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar');
    }
  }

  async function onActivate(training: Training) {
    try {
      await setActiveTraining(training.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido activar');
    }
  }

  if (!isNew && !existing) {
    return (
      <Screen title="Entrenamiento" stacked action={back}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText themeColor="textSecondary">No se ha encontrado este entrenamiento.</ThemedText>
        )}
      </Screen>
    );
  }

  const isActive = existing ? settings.activeTrainingId === existing.id : false;

  return (
    <Screen title={isNew ? 'Nuevo entrenamiento' : existing!.name} stacked action={back}>
      <Field label="Nombre" value={name} onChangeText={setName} placeholder="Fuerza, Definición…" />
      <DateField label="Fecha de inicio" value={startDate} onChange={setStartDate} />
      <View style={styles.weeks}>
        <View style={styles.weeksText}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Duración en semanas
          </ThemedText>
          {preview ? (
            <ThemedText type="small" themeColor="textSecondary">
              Termina el {formatDay(preview.endDate)}
            </ThemedText>
          ) : null}
        </View>
        <NumberInput accessibilityLabel="Semanas de duración" value={weeks} onChangeText={setWeeks} />
      </View>

      <View style={styles.restField}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Descanso entre series
        </ThemedText>
        <View style={styles.chips}>
          {REST_SECONDS_OPTIONS.map((seconds) => (
            <Chip
              key={seconds}
              label={seconds === 0 ? 'Sin' : `${seconds} s`}
              active={restSeconds === seconds}
              onPress={() => setRestSeconds(seconds)}
            />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Es el mismo para todas las rutinas de este entrenamiento.
        </ThemedText>
      </View>

      <ErrorText message={error} />
      <Button title={isNew ? 'Crear entrenamiento' : 'Guardar cambios'} onPress={onSave} loading={saving} />

      {existing && (
        <>
          <ThemedText type="smallBold" style={styles.section}>
            Rutinas
          </ThemedText>
          {existing.routines.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              Aún no tiene rutinas. Añade una por cada día de entreno: «Pecho + Espalda», «Pierna»…
            </ThemedText>
          ) : (
            existing.routines.map((routine) => {
              const summary = routineSummary(routine, byId);
              return (
                <Card
                  key={routine.id}
                  onPress={() =>
                    router.push({
                      pathname: '/entrenamiento/[id]/rutina/[rid]',
                      params: { id: existing.id, rid: routine.id },
                    })
                  }
                  style={styles.routine}>
                  <ThemedText type="smallBold">{routine.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {summary.counts}
                  </ThemedText>
                  {summary.preview ? <ThemedText type="small">{summary.preview}</ThemedText> : null}
                </Card>
              );
            })
          )}
          <Button
            variant="secondary"
            title="Añadir rutina"
            onPress={() =>
              router.push({
                pathname: '/entrenamiento/[id]/rutina/[rid]',
                params: { id: existing.id, rid: 'nueva' },
              })
            }
          />

          {isActive ? (
            <Card tone="primarySoft">
              <ThemedText type="smallBold">Es tu entrenamiento actual</ThemedText>
            </Card>
          ) : (
            <Button title="Usar como mi entrenamiento actual" onPress={() => onActivate(existing)} />
          )}
          <Button variant="danger" title="Borrar entrenamiento" onPress={onDelete} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weeks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  weeksText: { flex: 1 },
  restField: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  section: { marginTop: Spacing.two },
  routine: { gap: Spacing.one },
});
