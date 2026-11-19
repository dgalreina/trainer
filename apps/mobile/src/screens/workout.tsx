import { routineTitle, TECHNIQUE_LABELS, type PerformedSet, type WorkoutSession } from '@trainer/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, Vibration, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/card';
import { ExercisePicker } from '@/components/exercise-picker';
import { Button, Chip, ErrorText, LinkButton, NumberInput } from '@/components/form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { COACH_COLUMN } from '@/components/coach/coach-layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ReviewCard } from '@/components/coach/review-card';
import { useCoach } from '@/lib/coach';
import { SupersetMark } from '@/components/superset-mark';
import { chainBlocks, chainLabels } from '@/lib/superset';
import { api } from '@/lib/api';
import { beep, unlockAudio } from '@/lib/beep';
import { confirmAction } from '@/lib/confirm';
import { notifySessionsChanged, useSessionsVersion } from '@/lib/session-events';
import { useExercises } from '@/lib/exercises';
import { deleteItem, getItem, setItem } from '@/lib/storage';
import { useTrainings } from '@/lib/trainings';
import {
  buildDraft,
  draftKey,
  FEEDBACK_MAX_LENGTH,
  formatClock,
  lastPerformed,
  parseDraft,
  routineSignature,
  toSessionPayload,
  type WorkoutDraft,
  type WorkoutSummary,
} from '@/lib/workout-draft';

/** Segundos que se muestra «Descanso terminado» antes de limpiar el aviso. */
const REST_DONE_VISIBLE_MS = 4000;
/** Cuánto se ajusta el descanso con los botones −15 / +15. */
const REST_STEP_MS = 15_000;

/** Tick gris de un ejercicio terminado (el mismo gesto que las rutinas hechas de «Hoy»). */
function FinishedTick() {
  const theme = useTheme();
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={theme.textSecondary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12.5l5 5L20 6.5" />
    </Svg>
  );
}

/** Cruz gris de un ejercicio que hoy no se ha hecho (la misma cruz, sin pulsar, que el botón de la cabecera). */
function CrossIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

/** Tick del botón «terminado» (dentro de un círculo). */
function FinishIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12.5l5 5L20 6.5" />
    </Svg>
  );
}

/** Reloj que se actualiza cada `ms` mientras `active`; devuelve la hora actual en ms. */
function useNow(active: boolean, ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/** El entreno del día: una rutina del entrenamiento, con sus series editables, Comenzar y Finalizar. */
export function WorkoutScreen() {
  const { id, rid, at } = useLocalSearchParams<{ id: string; rid: string; at?: string }>();
  // Si se llega desde el calendario tocando una hora, el entreno empieza a esa hora.
  const startAt = Number(at) > 0 ? Number(at) : null;
  const router = useRouter();
  const theme = useTheme();
  const { trainings, loading, updateRoutine } = useTrainings();
  const { reviewSession, usage } = useCoach();
  const { byId } = useExercises();

  const training = trainings.find((t) => t.id === id);
  const routine = training?.routines.find((r) => r.id === rid);
  const title = training && routine ? routineTitle(training.routines, routine.id) : 'Entreno';
  // El descanso se define en la rutina, no mientras se entrena.
  const restSeconds = routine?.restSeconds ?? 0;
  /** El descanso de un ejercicio: el suyo si lo tiene, y si no el de la rutina. */
  const entryRest = (entry: { restSeconds?: number }) => entry.restSeconds ?? restSeconds;
  const key = draftKey(id, rid);

  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [lastByExercise, setLast] = useState<Map<string, PerformedSet[]>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState<WorkoutSummary | null>(null);
  // Ejercicios con el campo de nota abierto (por posición).
  const [noteOpen, setNoteOpen] = useState<Set<number>>(new Set());
  // Selector para añadir un ejercicio entero que no estaba en la rutina.
  const [picking, setPicking] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Carga el borrador guardado (el entreno sigue donde estaba aunque se cerrase la app) o
  // crea uno nuevo desde la rutina, precargando lo de la última vez.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !routine) return;
    loaded.current = true;
    (async () => {
      let last = new Map<string, PerformedSet[]>();
      try {
        last = lastPerformed(await api.get<WorkoutSession[]>('/sessions?limit=30'));
      } catch {
        // Sin historial no hay pistas ni precarga: el entreno se puede hacer igual.
      }
      setLast(last);

      const saved = parseDraft(await getItem(key));
      // Un entreno ya empezado se respeta; uno sin empezar se rehace si la rutina ha cambiado.
      const base =
        saved && (saved.startedAt !== null || saved.planSig === routineSignature(routine))
          ? saved
          : buildDraft(id, routine, last);
      setDraft(startAt !== null && base.startedAt === null ? { ...base, startedAt: startAt } : base);
    })();
  }, [routine, id, key]);

  // Guarda el borrador tras cada cambio (con una pequeña espera para no escribir en cada tecla).
  // El calendario muestra el entreno en cuanto se empieza: se avisa cuando el borrador ya está
  // guardado (es de donde lo lee) y el entreno ha pasado de sin empezar a empezado.
  const announcedStarted = useRef(false);
  useEffect(() => {
    if (!draft || finished) return;
    const timer = setTimeout(async () => {
      await setItem(key, JSON.stringify(draft));
      const started = draft.startedAt !== null;
      if (started !== announcedStarted.current) {
        announcedStarted.current = started;
        notifySessionsChanged();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, key, finished]);

  // Si la hora de inicio se corrige desde el calendario, se recoge aquí (solo la hora: lo demás es de esta pantalla).
  const sessionsVersion = useSessionsVersion();
  useEffect(() => {
    if (!draft || draft.startedAt === null) return;
    getItem(key).then((raw) => {
      const saved = parseDraft(raw);
      if (saved && saved.startedAt !== null && saved.startedAt !== draft.startedAt) {
        setDraft((d) => (d ? { ...d, startedAt: saved.startedAt } : d));
      }
    });
    // Solo cuando algo avisa de un cambio, no en cada edición del borrador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsVersion]);

  const patch = useCallback((change: (d: WorkoutDraft) => WorkoutDraft) => {
    setDraft((d) => (d ? change(d) : d));
  }, []);

  const running = draft?.startedAt != null && !finished;
  const resting = draft?.restEndsAt != null && !finished;
  const now = useNow(running || resting, 250);

  const restEndsAt = draft?.restEndsAt ?? null;

  // Pasados unos segundos del final del descanso, se limpia el aviso.
  useEffect(() => {
    if (restEndsAt === null) return;
    const wait = Math.max(restEndsAt - Date.now(), 0) + REST_DONE_VISIBLE_MS;
    const timer = setTimeout(
      () => patch((d) => (d.restEndsAt === restEndsAt ? { ...d, restEndsAt: null } : d)),
      wait,
    );
    return () => clearTimeout(timer);
  }, [restEndsAt, patch]);

  // Al llegar a cero, aviso por vibración y sonido, una sola vez por descanso. Un descanso ya
  // vencido de hace rato (al reabrir la app) no avisa.
  const notified = useRef<number | null>(null);
  useEffect(() => {
    if (restEndsAt === null || now < restEndsAt || now - restEndsAt > 2000) return;
    if (notified.current === restEndsAt) return;
    notified.current = restEndsAt;
    Vibration.vibrate([200, 100, 200]);
    beep();
  }, [now, restEndsAt]);

  function start() {
    unlockAudio();
    patch((d) => (d.startedAt === null ? { ...d, startedAt: Date.now() } : d));
  }

  function toggleDone(entryIndex: number, setIndex: number) {
    unlockAudio();
    patch((d) => {
      const entry = d.entries[entryIndex];
      const becomesDone = !entry.sets[setIndex].done;
      const isLastSet =
        setIndex === entry.sets.length - 1 || entry.sets.every((st, j) => j === setIndex || st.done);
      const entries = d.entries.map((e, i) =>
        i !== entryIndex
          ? e
          : { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, done: becomesDone } : s)) },
      );
      const at = Date.now();
      return {
        ...d,
        entries,
        // Marcar una serie empieza el entreno si no se había empezado.
        startedAt: d.startedAt ?? (becomesDone ? at : null),
        // En una superserie no se descansa entre sus ejercicios, solo al acabar la ronda (con el descanso del
        // último). Cada ejercicio puede traer el suyo; si no, el de la rutina.
        // Si es la última serie del ejercicio (la de más abajo, o ya están todas hechas) no hay descanso: lo siguiente es
        // otro ejercicio u otro bloque, y el contador que hubiera de la serie anterior tampoco hace falta.
        restEndsAt: !becomesDone
          ? d.restEndsAt
          : isLastSet
            ? null
            : entryRest(entry) > 0 && entry.technique !== 'ss'
              ? at + entryRest(entry) * 1000
              : d.restEndsAt,
      };
    });
  }

  function changeSet(entryIndex: number, setIndex: number, field: 'reps' | 'weightKg', text: string) {
    patch((d) => ({
      ...d,
      entries: d.entries.map((e, i) =>
        i !== entryIndex
          ? e
          : { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, [field]: text } : s)) },
      ),
    }));
  }

  /** Añade al final un ejercicio de hoy (solo en este entreno: la rutina no cambia), con las series de la última vez o tres vacías. */
  function addExercise(exerciseId: string) {
    setPicking(false);
    const previous = lastByExercise.get(exerciseId) ?? [];
    const sets = (previous.length > 0 ? previous : [{}, {}, {}]).map((s: Partial<PerformedSet>) => ({
      reps: !s.reps ? '' : String(s.reps),
      weightKg: s.weightKg === undefined ? '' : String(s.weightKg),
      done: false,
    }));
    patch((d) => ({ ...d, entries: [...d.entries, { exerciseId, sets, added: true }] }));
  }

  function addSet(entryIndex: number) {
    patch((d) => ({
      ...d,
      entries: d.entries.map((e, i) => {
        if (i !== entryIndex) return e;
        // La serie nueva copia la anterior: casi siempre se repite el peso.
        const previous = e.sets[e.sets.length - 1] ?? { reps: '', weightKg: '' };
        return { ...e, sets: [...e.sets, { reps: previous.reps, weightKg: previous.weightKg, done: false }] };
      }),
    }));
  }

  function setEntryFinished(entryIndex: number, finished: boolean) {
    patch((d) => ({ ...d, entries: d.entries.map((e, i) => (i === entryIndex ? { ...e, finished } : e)) }));
  }

  function setEntrySkipped(entryIndex: number, skipped: boolean) {
    patch((d) => ({
      ...d,
      entries: d.entries.map((e, i) => (i === entryIndex ? { ...e, skipped, finished: skipped ? false : e.finished } : e)),
    }));
  }

  function changeFeedback(entryIndex: number, text: string) {
    patch((d) => ({ ...d, entries: d.entries.map((e, i) => (i === entryIndex ? { ...e, feedback: text } : e)) }));
  }

  function removeSet(entryIndex: number, setIndex: number) {
    patch((d) => ({
      ...d,
      entries: d.entries.map((e, i) =>
        i !== entryIndex || e.sets.length === 1 ? e : { ...e, sets: e.sets.filter((_, j) => j !== setIndex) },
      ),
    }));
  }

  async function finish() {
    if (!draft) return;
    setError(null);
    // Marcar las series es opcional: si no se marca ninguna, se acaba igual y cuentan todas (con las repeticiones que tengan).
    const result = toSessionPayload(draft, Date.now(), true);
    if (!result) {
      return setError('No hay nada que guardar: escribe el peso o las repeticiones de lo que has hecho, o marca alguna serie.');
    }

    // Un toque sin querer no debe cerrar el entreno: se pide confirmación antes de guardarlo.
    const ok = await confirmAction('Finalizar entreno', '¿Has terminado? Se guardará en tu calendario.', 'Finalizar', false);
    if (!ok) return;

    setSaving(true);
    try {
      const saved = await api.post<WorkoutSession>('/sessions', result.payload);
      await deleteItem(key);
      // El calendario se recarga: el entreno pasa de «en curso» a registrado.
      notifySessionsChanged();
      setFinished(result.summary);
      // El entrenador analiza el entreno en segundo plano y, al acabar, habla él primero (si el plan incluye IA).
      reviewSession(saved.id);
      await offerAddedExercises(result.payload.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar el entreno');
    } finally {
      setSaving(false);
    }
  }

  /** Los ejercicios añadidos a mano que se han guardado: ofrece dejarlos en la rutina para los próximos entrenos. */
  async function offerAddedExercises(saved: { exerciseId: string; sets: { reps: number }[] }[]) {
    if (!draft || !routine) return;
    const inRoutine = new Set(routine.slots.map((s) => s.exerciseId));
    const extras = draft.entries
      .filter((e) => e.added && !e.skipped && !inRoutine.has(e.exerciseId))
      .flatMap((e) => {
        const entry = saved.find((s) => s.exerciseId === e.exerciseId);
        return entry ? [entry] : [];
      });
    if (extras.length === 0) return;
    const names = extras.map((e) => byId.get(e.exerciseId)?.name ?? 'Ejercicio').join(', ');
    const ok = await confirmAction(
      'Añadir a la rutina',
      `Hoy has añadido ${names}. ¿Quieres dejarlo en la rutina para los próximos entrenos?`,
      'Añadir a la rutina',
      false,
    );
    if (!ok) return;
    try {
      await updateRoutine(id, rid, {
        slots: [...routine.slots, ...extras.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => ({ reps: s.reps })) }))],
      });
    } catch {
      // La sesión ya está guardada; si esto falla, se puede añadir desde Entrenamientos.
    }
  }

  async function discard() {
    const ok = await confirmAction(
      'Descartar entreno',
      'Se perderá lo que llevas anotado de este entreno.',
      'Descartar',
    );
    if (!ok) return;
    await deleteItem(key);
    notifySessionsChanged();
    goBack();
  }

  if (!training || !routine) {
    return (
      <Screen title="Entreno" stacked onBack={goBack}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText themeColor="textSecondary">No se ha encontrado esta rutina.</ThemedText>
        )}
      </Screen>
    );
  }

  if (finished) {
    return (
      <Screen title="¡Entreno guardado!" subtitle={title} stacked>
        <Card tone="primarySoft">
          <ThemedText type="smallBold">Resumen</ThemedText>
          <ThemedText>
            {finished.sets} {finished.sets === 1 ? 'serie' : 'series'} · {finished.volumeKg.toLocaleString('es-ES')} kg
            movidos
            {finished.durationSeconds !== null ? ` · ${formatClock(finished.durationSeconds)}` : ''}
          </ThemedText>
          {/* Solo si el plan incluye IA: es quien analiza el entreno y habla después, junto al icono. */}
          {usage && usage.capTokens > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Tu entrenador está mirando cómo ha ido: te dirá algo en unos segundos.
            </ThemedText>
          ) : null}
        </Card>
        <Button title="Volver a Hoy" onPress={() => router.navigate('/')} />
      </Screen>
    );
  }

  if (!draft) {
    return (
      <Screen title={title} subtitle={training.name} stacked onBack={goBack}>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }

  const restRemaining = draft.restEndsAt === null ? null : Math.ceil((draft.restEndsAt - now) / 1000);

  // La barra de abajo deja libre, a la derecha, la columna del icono del entrenador (la barra ya tiene su margen de 24 px).
  const footer = (
    <View style={{ paddingRight: COACH_COLUMN - Spacing.four, gap: Spacing.two }}>
      {restRemaining !== null && (
        <View style={[styles.restBar, { backgroundColor: theme.primarySoft }]}>
          <View style={styles.restText}>
            <ThemedText type="small" themeColor="textSecondary">
              {restRemaining > 0 ? 'Descanso' : 'Descanso terminado'}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.restClock}>
              {restRemaining > 0 ? formatClock(restRemaining) : '¡A por la siguiente!'}
            </ThemedText>
          </View>
          {restRemaining > 0 && (
            <>
              <LinkButton
                title="−15 s"
                onPress={() => patch((d) => ({ ...d, restEndsAt: (d.restEndsAt ?? Date.now()) - REST_STEP_MS }))}
              />
              <LinkButton
                title="+15 s"
                onPress={() => patch((d) => ({ ...d, restEndsAt: (d.restEndsAt ?? Date.now()) + REST_STEP_MS }))}
              />
            </>
          )}
          {restRemaining > 0 ? (
            <LinkButton title="Saltar" onPress={() => patch((d) => ({ ...d, restEndsAt: null }))} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={() => patch((d) => ({ ...d, restEndsAt: null }))}
              hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ✕
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
      <ErrorText message={error} />
      <Button
        title={draft.startedAt === null ? 'Finalizar' : `Finalizar · ${formatClock((now - draft.startedAt) / 1000)}`}
        onPress={finish}
        loading={saving}
      />
    </View>
  );

  const labels = chainLabels(draft.entries);

  return (
    <Screen title={title} subtitle={training.name} stacked fade onBack={goBack} footer={footer}>
      {/* En marcha, el tiempo va en el botón «Finalizar» de abajo: aquí arriba ya no hace falta nada. */}
      {/* Las mejoras que el entrenador dejó la última vez que hiciste esta rutina: las cumples o no. */}
      <ReviewCard routineId={rid} />

      {draft.startedAt === null ? <Button title="Comenzar" onPress={start} /> : null}

      <ThemedText type="small" themeColor="textSecondary">
        {restSeconds > 0
          ? `Descanso entre series: ${restSeconds} s`
          : 'Sin descanso entre series'}
      </ThemedText>

      {chainBlocks(draft.entries).map((block, blockIndex) => (
        <View key={blockIndex} style={block.length > 1 ? [styles.chain, { borderLeftColor: theme.primary }] : undefined}>
      {block.map(({ item: entry, index: entryIndex }, pos) => {
        const last = lastByExercise.get(entry.exerciseId);
        return (
          <View key={`${entry.exerciseId}-${entryIndex}`} style={block.length > 1 ? styles.chainItem : undefined}>
          <Card
            // Un ejercicio terminado se ve atenuado, como las rutinas hechas de «Hoy».
            style={[styles.exercise, (entry.finished || entry.skipped) && styles.finishedCard]}>
            <View style={styles.exerciseHeader}>
              <ThemedText type="smallBold" style={styles.exerciseTitle}>
                {labels[entryIndex]}{'  '}{byId.get(entry.exerciseId)?.name ?? 'Ejercicio eliminado'}
              </ThemedText>
              {entry.finished ? (
                <FinishedTick />
              ) : entry.skipped ? (
                <CrossIcon color={theme.textSecondary} />
              ) : (
                // La cruz de la cabecera: «este ejercicio no lo he hecho hoy».
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hoy no he hecho este ejercicio"
                  onPress={() => setEntrySkipped(entryIndex, true)}
                  hitSlop={10}>
                  <CrossIcon color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
            {/* La superserie ya se ve en el bloque (filo, 1a/1b y marca «SUPERSERIE»). */}
            {entry.technique && entry.technique !== 'ss' && (
              <ThemedText type="small" themeColor="primaryText">
                {TECHNIQUE_LABELS[entry.technique]}
              </ThemedText>
            )}
            {entry.notes ? (
              <ThemedText type="small" themeColor="textSecondary">
                {entry.notes}
              </ThemedText>
            ) : null}
            {entry.restSeconds !== undefined && entry.restSeconds !== restSeconds ? (
              <ThemedText type="small" themeColor="textSecondary">
                {entry.restSeconds === 0 ? 'Sin descanso en este ejercicio' : `Descanso de este ejercicio: ${entry.restSeconds} s`}
              </ThemedText>
            ) : null}
            {/* Terminado: las series no se tocan hasta «Retomar». */}
            <View pointerEvents={entry.finished || entry.skipped ? 'none' : 'auto'} style={styles.setsBlock}>
            {/* Cabecera de las columnas: mismos huecos que una fila de serie, para que cada título quede sobre su campo. */}
            <View style={styles.setRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.checkSpace} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.columnTitle}>
                Repeticiones
              </ThemedText>
              <ThemedText style={styles.hidden}>×</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.columnTitle}>
                Peso
              </ThemedText>
              <ThemedText type="small" style={styles.hidden}>✕</ThemedText>
            </View>

            {entry.sets.map((set, setIndex) => {
              const delta = numberDelta(set.weightKg, last?.[setIndex]?.weightKg);
              const repsDelta = numberDelta(set.reps, last?.[setIndex]?.reps || undefined);
              return (
              <View key={setIndex} style={styles.setRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: set.done }}
                  accessibilityLabel={`Serie ${setIndex + 1} hecha`}
                  onPress={() => toggleDone(entryIndex, setIndex)}
                  style={[styles.check, { backgroundColor: set.done ? theme.primary : theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={{ color: set.done ? theme.onPrimary : theme.textSecondary }}>
                    {set.done ? '✓' : setIndex + 1}
                  </ThemedText>
                </Pressable>
                <View style={styles.cell}>
                  <NumberInput
                    accessibilityLabel={`Repeticiones de la serie ${setIndex + 1}`}
                    placeholder="reps"
                    value={set.reps}
                    highlight={repsDelta !== null}
                    onChangeText={(text) => changeSet(entryIndex, setIndex, 'reps', text)}
                  />
                  {repsDelta !== null && (
                    <ThemedText type="small" themeColor="primaryText" style={styles.delta}>
                      {formatDelta(repsDelta)} {Math.abs(repsDelta) === 1 ? 'rep' : 'reps'}
                    </ThemedText>
                  )}
                </View>
                <ThemedText themeColor="textSecondary">×</ThemedText>
                <View style={styles.cell}>
                  <NumberInput
                    accessibilityLabel={`Peso de la serie ${setIndex + 1}`}
                    placeholder="kg"
                    value={set.weightKg}
                    highlight={delta !== null}
                    onChangeText={(text) => changeSet(entryIndex, setIndex, 'weightKg', text)}
                  />
                  {/* Diferencia con esa serie la última vez (también en las repeticiones): así se ve la progresión sin otro texto. */}
                  {delta !== null && (
                    <ThemedText type="small" themeColor="primaryText" style={styles.delta}>
                      {formatDelta(delta)} kg
                    </ThemedText>
                  )}
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
              );
            })}
            </View>

            {entry.skipped ? (
              <View style={styles.exerciseActions}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.feedbackText}>
                  Hoy no lo has hecho: no se guardará.
                </ThemedText>
                <LinkButton title="Deshacer" onPress={() => setEntrySkipped(entryIndex, false)} />
              </View>
            ) : entry.finished ? (
              <View style={styles.exerciseActions}>
                {entry.feedback?.trim() ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.feedbackText}>
                    {entry.feedback.trim()}
                  </ThemedText>
                ) : (
                  <View style={styles.feedbackText} />
                )}
                <LinkButton title="Retomar" onPress={() => setEntryFinished(entryIndex, false)} />
              </View>
            ) : (
              <>
                {/* Izquierda «+» (otra serie), en medio la nota sobre cómo ha ido, derecha «terminado». */}
                <View style={styles.exerciseActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Añadir serie"
                    onPress={() => addSet(entryIndex)}
                    hitSlop={8}
                    style={[styles.roundButton, { backgroundColor: theme.backgroundSelected }]}>
                    {/* Dos barras en vez del carácter «+»: así queda exactamente centrado en cualquier tipografía. */}
                    <View style={[styles.plusBar, { backgroundColor: theme.primaryText }]} />
                    <View style={[styles.plusBar, styles.plusBarVertical, { backgroundColor: theme.primaryText }]} />
                  </Pressable>
                  <Chip
                    label="Nota"
                    active={noteOpen.has(entryIndex) || !!entry.feedback?.trim()}
                    onPress={() =>
                      setNoteOpen((open) => {
                        const next = new Set(open);
                        if (next.has(entryIndex)) next.delete(entryIndex);
                        else next.add(entryIndex);
                        return next;
                      })
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Marcar el ejercicio como terminado"
                    onPress={() => setEntryFinished(entryIndex, true)}
                    hitSlop={8}
                    style={[styles.roundButton, { borderColor: theme.primaryText, borderWidth: 2 }]}>
                    <FinishIcon color={theme.primaryText} />
                  </Pressable>
                </View>
                {noteOpen.has(entryIndex) || entry.feedback ? (
                  <TextInput
                    accessibilityLabel="Nota sobre cómo te ha ido el ejercicio"
                    value={entry.feedback ?? ''}
                    onChangeText={(text) => changeFeedback(entryIndex, text)}
                    placeholder="¿Cómo te ha ido este ejercicio?"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={FEEDBACK_MAX_LENGTH}
                    multiline
                    style={[styles.feedbackInput, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
                  />
                ) : null}
              </>
            )}
          </Card>
          {pos < block.length - 1 ? <SupersetMark /> : null}
          </View>
        );
      })}
        </View>
      ))}

      {/* «+» debajo del último ejercicio: añade uno entero a este entreno. */}
      <View style={styles.addExercise}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Añadir ejercicio"
          onPress={() => setPicking(true)}
          hitSlop={8}
          style={[styles.roundButton, styles.addExerciseButton, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.plusBar, { backgroundColor: theme.primaryText }]} />
          <View style={[styles.plusBar, styles.plusBarVertical, { backgroundColor: theme.primaryText }]} />
        </Pressable>
      </View>

      <LinkButton title="Descartar entreno" onPress={discard} />

      <ExercisePicker visible={picking} onSelect={(exercise) => addExercise(exercise.id)} onClose={() => setPicking(false)} />
    </Screen>
  );
}

/** Diferencia entre lo escrito (peso o repeticiones) y lo de la última vez (null si falta alguno o no hay cambio). */
function numberDelta(current: string, previous: number | undefined): number | null {
  const now = Number.parseFloat(current.replace(',', '.'));
  if (previous === undefined || !Number.isFinite(now)) return null;
  const diff = Math.round((now - previous) * 100) / 100;
  return diff === 0 ? null : diff;
}

const formatDelta = (diff: number) => `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('es-ES')}`;

const styles = StyleSheet.create({
  exercise: { gap: Spacing.two + 2 },
  chain: { borderLeftWidth: 4, paddingLeft: Spacing.two, borderRadius: 4, gap: Spacing.one },
  chainItem: { gap: 0 },
  finishedCard: { opacity: 0.55 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  exerciseTitle: { flex: 1 },
  setsBlock: { gap: Spacing.two + 2 },
  exerciseActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  roundButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addExercise: { alignItems: 'center' },
  addExerciseButton: { width: 48, height: 48, borderRadius: 24 },
  plusBar: { position: 'absolute', width: 18, height: 3, borderRadius: 1.5 },
  plusBarVertical: { width: 3, height: 18 },
  feedbackText: { flex: 1 },
  feedbackInput: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  // El margen deja sitio debajo del peso para la diferencia con la última vez (+5 kg).
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: 6 },
  check: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  checkSpace: { width: 36 },
  cell: { flex: 1 },
  // Debajo del campo, en el hueco entre filas.
  delta: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 1, textAlign: 'center', fontSize: 10, lineHeight: 10 },
  columnTitle: { flex: 1, textAlign: 'center' },
  hidden: { opacity: 0 },
  restBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  restText: { flex: 1 },
  restClock: { fontSize: 24, lineHeight: 30 },
});
