import { type PerformedSet, type SessionEntry, type WorkoutSession } from '@trainer/shared';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ExercisePicker } from '@/components/exercise-picker';
import { Button, ErrorText, LinkButton, NumberInput } from '@/components/form';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { formatDay, isoOf, startOfDay } from '@/lib/dates';
import { useExercises } from '@/lib/exercises';
import { notifySessionsChanged } from '@/lib/session-events';

/** Una serie mientras se edita: los números son texto, como en los campos. */
interface SetDraft {
  reps: string;
  weightKg: string;
  rpe?: PerformedSet['rpe'];
}
interface EntryDraft extends Omit<SessionEntry, 'sets'> {
  sets: SetDraft[];
}

const two = (n: number) => String(n).padStart(2, '0');
const toText = (n: number) => String(n).replace('.', ',');
/** Un número escrito con coma o punto; null si hay cualquier otra cosa («12abc», «8-12»). */
const parseNumber = (text: string) => (/^\d+([.,]\d+)?$/.test(text.trim()) ? Number(text.trim().replace(',', '.')) : null);

/**
 * Un entreno ya terminado, para corregirlo o borrarlo: hora de inicio, duración, ejercicios (se pueden quitar
 * y añadir) y sus series. Se guarda con «Guardar cambios»; «Borrar entreno» lo quita del historial.
 */
export function SessionSheet({
  sessionId,
  title,
  onClose,
}: {
  /** La sesión que se abre; sin ella la ventana está cerrada. */
  sessionId: string | null;
  /** Cómo se llama el entreno en el calendario (la rutina). */
  title: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { byId } = useExercises();
  // Al cerrar, el título se conserva mientras dura el fundido de la ventana.
  const lastTitle = useRef(title);
  if (title) lastTitle.current = title;
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('');
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir se pide la sesión entera (el calendario solo conoce su hora y su nombre).
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setSession(null);
    setError(null);
    api
      .get<WorkoutSession>(`/sessions/${sessionId}`)
      .then((loaded) => {
        if (cancelled) return;
        const start = new Date(loaded.date);
        setSession(loaded);
        setTime(`${two(start.getHours())}:${two(start.getMinutes())}`);
        setMinutes(loaded.durationSeconds ? String(Math.round(loaded.durationSeconds / 60)) : '');
        setEntries(
          loaded.entries.map((e) => ({
            ...e,
            sets: e.sets.map((s) => ({ reps: String(s.reps), weightKg: toText(s.weightKg), rpe: s.rpe })),
          })),
        );
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'No se ha podido cargar el entreno'));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const patchSet = (entryIndex: number, setIndex: number, field: 'reps' | 'weightKg', text: string) =>
    setEntries((list) =>
      list.map((e, i) =>
        i !== entryIndex ? e : { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, [field]: text } : s)) },
      ),
    );
  const addSet = (entryIndex: number) =>
    setEntries((list) =>
      list.map((e, i) => {
        if (i !== entryIndex) return e;
        // La serie nueva copia la anterior: casi siempre se repite el peso.
        const previous = e.sets[e.sets.length - 1] ?? { reps: '', weightKg: '' };
        return { ...e, sets: [...e.sets, { reps: previous.reps, weightKg: previous.weightKg }] };
      }),
    );
  const removeSet = (entryIndex: number, setIndex: number) =>
    setEntries((list) =>
      list.map((e, i) =>
        i !== entryIndex || e.sets.length === 1 ? e : { ...e, sets: e.sets.filter((_, j) => j !== setIndex) },
      ),
    );
  const removeEntry = (entryIndex: number) => setEntries((list) => list.filter((_, i) => i !== entryIndex));

  async function save() {
    if (!session) return;
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return setError('Elige una hora válida');
    if (entries.length === 0) return setError('Un entreno necesita al menos un ejercicio. Si ya no existe, bórralo.');
    // Vacía = sin duración (0): se guarda como tal, no se deja la antigua sin avisar.
    const minutesNumber = minutes.trim() === '' ? 0 : parseNumber(minutes);
    if (minutesNumber === null || minutesNumber > 1440) {
      return setError('La duración debe ser un número de minutos entre 0 y 1440');
    }

    const payloadEntries: SessionEntry[] = [];
    for (const entry of entries) {
      const sets: PerformedSet[] = [];
      for (const s of entry.sets) {
        const reps = parseNumber(s.reps);
        const weightKg = s.weightKg.trim() === '' ? 0 : parseNumber(s.weightKg);
        if (reps === null || !Number.isInteger(reps) || reps > 1000 || weightKg === null || weightKg > 1000) {
          return setError(
            `Revisa las series de «${byId.get(entry.exerciseId)?.name ?? 'un ejercicio'}»: repeticiones enteras (hasta 1000) y peso en kg (hasta 1000).`,
          );
        }
        sets.push({ reps, weightKg, ...(s.rpe !== undefined && { rpe: s.rpe }) });
      }
      payloadEntries.push({ ...entry, sets });
    }

    // Mismo día, con la hora nueva.
    const moment = startOfDay(isoOf(new Date(session.date)));
    moment.setHours(Number(match[1]), Number(match[2]));

    setSaving(true);
    setError(null);
    try {
      await api.patch(`/sessions/${session.id}`, {
        date: moment.toISOString(),
        durationSeconds: Math.round(minutesNumber * 60),
        entries: payloadEntries,
      });
      notifySessionsChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar el entreno');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!session) return;
    const ok = await confirmAction(
      'Borrar entreno',
      'Se borrará este entreno del historial. Los pesos de la próxima vez se tomarán del entreno anterior.',
      'Borrar',
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/sessions/${session.id}`);
      notifySessionsChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar el entreno');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet visible={sessionId !== null} onClose={() => !saving && onClose()}>
        <View>
          <ThemedText type="smallBold">{lastTitle.current}</ThemedText>
          {session ? (
            <ThemedText type="small" themeColor="textSecondary">
              {formatDay(isoOf(new Date(session.date)))}
            </ThemedText>
          ) : null}
        </View>

        {!session ? (
          error ? <ErrorText message={error} /> : <ActivityIndicator color={theme.primary} accessibilityLabel="Cargando el entreno" />
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.half}>
                <TimeField label="Hora de inicio" value={time} onChange={setTime} />
              </View>
              <View style={styles.half}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Duración (min)
                </ThemedText>
                <NumberInput field accessibilityLabel="Duración en minutos" placeholder="min" value={minutes} onChangeText={setMinutes} />
              </View>
            </View>

            {entries.map((entry, entryIndex) => (
              <View key={`${entry.exerciseId}-${entryIndex}`} style={[styles.exercise, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.exerciseHeader}>
                  <ThemedText type="smallBold" style={styles.exerciseName}>
                    {byId.get(entry.exerciseId)?.name ?? 'Ejercicio eliminado'}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${byId.get(entry.exerciseId)?.name ?? 'el ejercicio'}`}
                    onPress={() => removeEntry(entryIndex)}
                    hitSlop={10}>
                    <ThemedText themeColor="textSecondary">✕</ThemedText>
                  </Pressable>
                </View>
                <View style={styles.setRow}>
                  <View style={styles.num} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.columnTitle}>
                    Repeticiones
                  </ThemedText>
                  <ThemedText style={styles.hidden}>×</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.columnTitle}>
                    Peso
                  </ThemedText>
                  <ThemedText type="small" style={styles.hidden}>✕</ThemedText>
                </View>
                {entry.sets.map((set, setIndex) => (
                  <View key={setIndex} style={styles.setRow}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.num}>
                      {setIndex + 1}
                    </ThemedText>
                    <View style={styles.cell}>
                      <NumberInput
                        accessibilityLabel={`Repeticiones de la serie ${setIndex + 1} de ${byId.get(entry.exerciseId)?.name ?? 'un ejercicio'}`}
                        placeholder="reps"
                        value={set.reps}
                        onChangeText={(text) => patchSet(entryIndex, setIndex, 'reps', text)}
                      />
                    </View>
                    <ThemedText themeColor="textSecondary">×</ThemedText>
                    <View style={styles.cell}>
                      <NumberInput
                        accessibilityLabel={`Peso de la serie ${setIndex + 1} de ${byId.get(entry.exerciseId)?.name ?? 'un ejercicio'}`}
                        placeholder="kg"
                        value={set.weightKg}
                        onChangeText={(text) => patchSet(entryIndex, setIndex, 'weightKg', text)}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar serie ${setIndex + 1}`}
                      onPress={() => removeSet(entryIndex, setIndex)}
                      disabled={entry.sets.length === 1}
                      hitSlop={8}
                      style={entry.sets.length === 1 ? styles.disabled : undefined}>
                      <ThemedText type="small" themeColor="textSecondary">✕</ThemedText>
                    </Pressable>
                  </View>
                ))}
                <LinkButton title="+ Serie" onPress={() => addSet(entryIndex)} />
              </View>
            ))}

            <Button variant="secondary" title="+ Añadir ejercicio" onPress={() => setPicking(true)} />
            <ErrorText message={error} />
            <Button title="Guardar cambios" onPress={save} loading={saving} />
            <Button variant="danger" title="Borrar entreno" onPress={remove} disabled={saving} />
          </>
        )}
      </Sheet>

      <ExercisePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={(exercise) => {
          setEntries((list) => [...list, { exerciseId: exercise.id, sets: [{ reps: '', weightKg: '' }] }]);
          setPicking(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1, gap: Spacing.one },
  exercise: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  exerciseName: { flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  num: { width: 20, textAlign: 'center' },
  cell: { flex: 1 },
  columnTitle: { flex: 1, textAlign: 'center' },
  hidden: { opacity: 0 },
  disabled: { opacity: 0.3 },
});
