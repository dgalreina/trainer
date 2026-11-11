import { dayLabel, MAX_TRAINING_WEEKS, trainingProgress } from '@trainer/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { Button, ErrorText, Field, NumberInput } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { formatDay, isValidISODate, todayISO } from '@/lib/dates';
import { useExercises } from '@/lib/exercises';
import { NEW_TRAINING_ID } from '@/lib/new-training';
import { routineSummary } from '@/lib/routine-summary';
import { useTrainings } from '@/lib/trainings';

const DEFAULT_WEEKS = 8;

/** Entrenamiento: sus datos (nombre, inicio, semanas) y las rutinas que lleva dentro. */
export function TrainingEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // «nuevo»: el formulario está en blanco y el entrenamiento no existe hasta que se escribe un nombre.
  const isNew = id === NEW_TRAINING_ID;
  const router = useRouter();
  const theme = useTheme();
  const { trainings, loading, create, update, remove, addRoutine, removeRoutine } = useTrainings();
  const { byId } = useExercises();

  const [createdId, setCreatedId] = useState<string | null>(null);
  const existing = trainings.find((t) => t.id === (isNew ? createdId : id));

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [weeks, setWeeks] = useState(String(DEFAULT_WEEKS));
  const [error, setError] = useState<string | null>(null);

  // El formulario se rellena una sola vez, cuando el entrenamiento está disponible.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !existing) return;
    initialized.current = true;
    // Recién creado desde este formulario: los campos ya son los que ha escrito el usuario.
    if (isNew) return;
    setName(existing.name);
    setStartDate(existing.startDate);
    setWeeks(String(existing.durationWeeks));
  }, [existing, isNew]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/entrenamientos'));
  const weeksNumber = Number.parseInt(weeks, 10);
  const datesValid = isValidISODate(startDate) && weeksNumber >= 1 && weeksNumber <= MAX_TRAINING_WEEKS;
  const preview = datesValid
    ? trainingProgress({ startDate, durationWeeks: weeksNumber }, todayISO())
    : null;

  // El nombre es obligatorio: el entrenamiento nuevo se crea en cuanto lo tiene (y fechas válidas).
  const creating = useRef(false);
  useEffect(() => {
    if (!isNew || createdId || creating.current) return;
    if (!name.trim() || !datesValid) return;
    const timer = setTimeout(async () => {
      creating.current = true;
      try {
        const created = await create({ name: name.trim(), startDate, durationWeeks: weeksNumber });
        setCreatedId(created.id);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se ha podido crear');
      } finally {
        creating.current = false;
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [isNew, createdId, name, startDate, weeksNumber, datesValid, create]);

  // Un entrenamiento que ya existe se guarda solo: al dejar de tocar un campo válido, se envía el cambio.
  useEffect(() => {
    if (!existing || !initialized.current) return;
    const trimmed = name.trim();
    if (!trimmed || !datesValid) return;
    if (
      trimmed === existing.name &&
      startDate === existing.startDate &&
      weeksNumber === existing.durationWeeks
    ) {
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await update(existing.id, { name: trimmed, startDate, durationWeeks: weeksNumber });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se ha podido guardar');
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [existing, name, startDate, weeksNumber, datesValid, update]);

  /** Crea la siguiente rutina, vacía y sin nombre: «Día N» es su posición, el nombre y los ejercicios se ponen al abrirla. */
  async function onAddRoutine() {
    if (!existing) return;
    setError(null);
    try {
      await addRoutine(existing.id, { name: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido añadir la rutina');
    }
  }

  /** Solo se borra desde aquí una rutina vacía; con ejercicios se borra desde dentro. */
  async function onRemoveEmptyRoutine(routineId: string) {
    if (!existing) return;
    setError(null);
    try {
      await removeRoutine(existing.id, routineId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar la rutina');
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

  if (!existing && !isNew) {
    return (
      <Screen title="Entrenamiento" stacked onBack={goBack}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText themeColor="textSecondary">No se ha encontrado este entrenamiento.</ThemedText>
        )}
      </Screen>
    );
  }

  return (
    <Screen title={isNew ? 'Nuevo entrenamiento' : (existing?.name ?? '')} stacked fade onBack={goBack}>
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
        <View style={styles.stepper}>
          <StepButton label="Menos semanas" glyph="−" disabled={!(weeksNumber > 1)} onPress={() => setWeeks(String(weeksNumber - 1))} />
          <NumberInput accessibilityLabel="Semanas de duración" compact value={weeks} onChangeText={setWeeks} />
          <StepButton
            label="Más semanas"
            glyph="+"
            disabled={weeksNumber >= MAX_TRAINING_WEEKS}
            onPress={() => setWeeks(String((Number.isFinite(weeksNumber) ? weeksNumber : 0) + 1))}
          />
        </View>
      </View>

      <ErrorText message={error} />

      {!existing && (
        <ThemedText themeColor="textSecondary">
          Escribe un nombre para crear el entrenamiento y añadirle rutinas.
        </ThemedText>
      )}

      {existing && (
        <>
          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold">Rutinas</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Añadir rutina"
              onPress={onAddRoutine}
              style={[styles.plus, { backgroundColor: theme.primary }]}>
              <View style={[styles.plusBar, styles.plusH, { backgroundColor: theme.onPrimary }]} />
              <View style={[styles.plusBar, styles.plusV, { backgroundColor: theme.onPrimary }]} />
            </Pressable>
          </View>
          {existing.routines.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              Aún no tiene rutinas. Toca + para crear el Día 1, el Día 2… y luego ábrelos para ponerles nombre y ejercicios.
            </ThemedText>
          ) : (
            existing.routines.map((routine, index) => {
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
                  <View style={styles.routineRow}>
                    <View style={styles.routineText}>
                      <ThemedText type="small" themeColor="primaryText">
                        {dayLabel(index)}
                      </ThemedText>
                      <ThemedText type="smallBold">{routine.name || 'Sin nombre'}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {summary.counts}
                      </ThemedText>
                      {summary.preview ? <ThemedText type="small">{summary.preview}</ThemedText> : null}
                    </View>
                    {routine.slots.length === 0 && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Borrar ${dayLabel(index)}`}
                        hitSlop={10}
                        onPress={() => onRemoveEmptyRoutine(routine.id)}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>✕</ThemedText>
                      </Pressable>
                    )}
                  </View>
                </Card>
              );
            })
          )}
          <Button variant="danger" title="Borrar entrenamiento" onPress={onDelete} />
        </>
      )}
    </Screen>
  );
}

function StepButton({
  label,
  glyph,
  disabled,
  onPress,
}: {
  label: string;
  glyph: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.step, { backgroundColor: theme.backgroundSelected }, disabled && styles.stepDisabled]}>
      <ThemedText type="subtitle" style={styles.stepGlyph}>
        {glyph}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  step: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepDisabled: { opacity: 0.35 },
  stepGlyph: { fontSize: 24, lineHeight: 28 },
  weeks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  weeksText: { flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.two },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  plusBar: { position: 'absolute', borderRadius: 1 },
  plusH: { width: 18, height: 2.5 },
  plusV: { width: 2.5, height: 18 },
  routine: { gap: Spacing.one },
  routineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  routineText: { flex: 1 },
});
