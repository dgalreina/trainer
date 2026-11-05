import {
  exerciseNameKey,
  REST_SECONDS_OPTIONS,
  type Exercise,
  type Routine,
  type UpdateRoutine,
} from '@trainer/shared';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip, NumberInput } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useExercises } from '@/lib/exercises';

// El editor trabaja con texto en los campos numéricos y lo convierte al guardar.
interface EditorSet {
  reps: string;
  weightKg: string;
}
interface EditorSlot {
  key: string;
  /** Nulo: hueco libre donde escribir el siguiente ejercicio (nunca se guarda). */
  exerciseId: string | null;
  sets: EditorSet[];
  linkedToNext: boolean;
  restPause: boolean;
  notes?: string;
}

const DEFAULT_SETS = 4;
const MIN_QUERY = 2;
const MAX_SUGGESTIONS = 6;
const SAVE_DELAY_MS = 700;

let keyCounter = 0;
const newKey = () => `slot-${keyCounter++}`;

const emptySlot = (): EditorSlot => ({
  key: newKey(),
  exerciseId: null,
  sets: Array.from({ length: DEFAULT_SETS }, () => ({ reps: '', weightKg: '' })),
  linkedToNext: false,
  restPause: false,
});

const toText = (n?: number) => (n === undefined ? '' : String(n));

function toNumber(text: string): number | undefined {
  const value = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** Los ejercicios de la rutina más un hueco libre al final, para seguir escribiendo. */
function withTrailingEmpty(slots: EditorSlot[]): EditorSlot[] {
  return slots[slots.length - 1]?.exerciseId === null ? slots : [...slots, emptySlot()];
}

function fromRoutine(routine: Routine): EditorSlot[] {
  return withTrailingEmpty(
    routine.slots.map((slot) => ({
      key: newKey(),
      exerciseId: slot.exerciseId,
      sets: slot.sets.map((s) => ({ reps: toText(s.reps), weightKg: toText(s.weightKg) })),
      linkedToNext: slot.linkedToNext,
      restPause: slot.restPause,
      notes: slot.notes,
    })),
  );
}

function toPayload(name: string, restSeconds: number, slots: EditorSlot[]): UpdateRoutine {
  const filled = slots.filter((s) => s.exerciseId !== null);
  return {
    name: name.trim(),
    restSeconds,
    slots: filled.map((slot, index) => ({
      exerciseId: slot.exerciseId as string,
      sets: slot.sets.map((s) => {
        const reps = toNumber(s.reps);
        return { reps: reps === undefined ? undefined : Math.round(reps), weightKg: toNumber(s.weightKg) };
      }),
      // El último no puede ir encadenado con «el siguiente».
      linkedToNext: index < filled.length - 1 && slot.linkedToNext,
      restPause: slot.restPause,
      notes: slot.notes,
    })),
  };
}

/**
 * Formulario de una rutina, todo en la misma página: nombre, ejercicios con sus series y
 * descanso. Se guarda solo, sin botón.
 */
export function RoutineForm({
  routine,
  onSave,
}: {
  routine: Routine;
  onSave: (changes: UpdateRoutine) => Promise<void>;
}) {
  const theme = useTheme();
  const { byId } = useExercises();

  const [name, setName] = useState(routine.name);
  const [restSeconds, setRestSeconds] = useState<number>(routine.restSeconds);
  const [slots, setSlots] = useState<EditorSlot[]>(() => fromRoutine(routine));

  // Lo último que se envió (o llegó del servidor): solo se guarda cuando algo cambia de verdad.
  const saved = useRef(JSON.stringify(toPayload(routine.name, routine.restSeconds, fromRoutine(routine))));
  useEffect(() => {
    const payload = toPayload(name, restSeconds, slots);
    const serialized = JSON.stringify(payload);
    if (serialized === saved.current) return;
    const timer = setTimeout(() => {
      saved.current = serialized;
      onSave(payload).catch(() => {
        // Se reintenta con el siguiente cambio.
        saved.current = '';
      });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [name, restSeconds, slots, onSave]);

  const updateSlot = (key: string, change: (slot: EditorSlot) => EditorSlot) =>
    setSlots((prev) => withTrailingEmpty(prev.map((s) => (s.key === key ? change(s) : s))));

  const removeSlot = (key: string) =>
    setSlots((prev) => {
      const at = prev.findIndex((s) => s.key === key);
      const next = prev.filter((s) => s.key !== key);
      // Si el anterior iba encadenado con el que se borra, se queda suelto.
      if (at > 0 && prev[at - 1].linkedToNext && next[at - 1]) {
        next[at - 1] = { ...next[at - 1], linkedToNext: false };
      }
      return withTrailingEmpty(next);
    });

  const moveSlot = (at: number, delta: -1 | 1) =>
    setSlots((prev) => {
      const target = at + delta;
      if (target < 0 || target >= prev.length || prev[target].exerciseId === null) return prev;
      const next = [...prev];
      [next[at], next[target]] = [next[target], next[at]];
      return next;
    });

  // «SS»: encadena con el siguiente y deja un hueco justo detrás para continuar la cadena.
  const toggleSuperset = (key: string) =>
    setSlots((prev) => {
      const at = prev.findIndex((s) => s.key === key);
      if (at < 0) return prev;
      const next = [...prev];
      if (next[at].linkedToNext) {
        next[at] = { ...next[at], linkedToNext: false };
      } else {
        next[at] = { ...next[at], linkedToNext: true };
        if (next[at + 1]?.exerciseId == null) next.splice(at + 1, 0, emptySlot());
      }
      return withTrailingEmpty(next);
    });

  const filledCount = slots.filter((s) => s.exerciseId !== null).length;

  return (
    <View style={styles.form}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Nombre (opcional)
      </ThemedText>
      <TextInput
        accessibilityLabel="Nombre de la rutina"
        value={name}
        onChangeText={setName}
        placeholder="Pecho + Espalda, Pierna…"
        placeholderTextColor={theme.textSecondary}
        style={[styles.nameInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />

      {slots.map((slot, at) => (
        <SlotRow
          key={slot.key}
          slot={slot}
          label={slot.exerciseId === null ? '+' : String(slots.slice(0, at + 1).filter((s) => s.exerciseId !== null).length)}
          isFirst={at === 0}
          isLastFilled={at >= filledCount - 1}
          onChange={(change) => updateSlot(slot.key, change)}
          onPick={(exercise) => updateSlot(slot.key, (s) => ({ ...s, exerciseId: exercise.id }))}
          onRemove={() => removeSlot(slot.key)}
          onMove={(delta) => moveSlot(at, delta)}
          onToggleSuperset={() => toggleSuperset(slot.key)}
          exerciseName={slot.exerciseId ? (byId.get(slot.exerciseId)?.name ?? 'Ejercicio eliminado') : ''}
        />
      ))}

      <View style={styles.rest}>
        <ThemedText type="small" themeColor="textSecondary">
          Descanso entre series
        </ThemedText>
        <View style={styles.restChips}>
          {REST_SECONDS_OPTIONS.map((seconds) => (
            <Chip
              key={seconds}
              label={seconds === 0 ? 'Sin' : `${seconds} s`}
              active={restSeconds === seconds}
              onPress={() => setRestSeconds(seconds)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function SlotRow({
  slot,
  label,
  exerciseName,
  isFirst,
  isLastFilled,
  onChange,
  onPick,
  onRemove,
  onMove,
  onToggleSuperset,
}: {
  slot: EditorSlot;
  label: string;
  exerciseName: string;
  isFirst: boolean;
  isLastFilled: boolean;
  onChange: (change: (slot: EditorSlot) => EditorSlot) => void;
  onPick: (exercise: Exercise) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onToggleSuperset: () => void;
}) {
  const theme = useTheme();
  const { exercises, create } = useExercises();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const key = exerciseNameKey(query);
  const suggestions =
    key.length >= MIN_QUERY
      ? exercises.filter((e) => exerciseNameKey(e.name).includes(key)).slice(0, MAX_SUGGESTIONS)
      : [];
  const exact = suggestions.some((e) => exerciseNameKey(e.name) === key);

  function pick(exercise: Exercise) {
    setQuery('');
    onPick(exercise);
  }

  async function createTyped() {
    const typed = query.trim();
    if (!typed || creating) return;
    setCreating(true);
    try {
      pick(await create(typed, 'otros'));
    } finally {
      setCreating(false);
    }
  }

  const hasExercise = slot.exerciseId !== null;
  const setField = (i: number, field: keyof EditorSet, text: string) =>
    onChange((s) => ({ ...s, sets: s.sets.map((x, j) => (j === i ? { ...x, [field]: text } : x)) }));

  return (
    <View style={[styles.slot, { borderColor: theme.backgroundSelected }]}>
      <View style={styles.slotHeader}>
        <View style={[styles.number, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {label}
          </ThemedText>
        </View>

        {hasExercise ? (
          <View style={[styles.chosen, { backgroundColor: theme.primarySoft }]}>
            <ThemedText type="smallBold" style={styles.chosenName} numberOfLines={2}>
              {exerciseName}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${exerciseName}`}
              hitSlop={10}
              onPress={onRemove}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                ✕
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <TextInput
            accessibilityLabel="Buscar ejercicio"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => (suggestions[0] ? pick(suggestions[0]) : createTyped())}
            placeholder="Escribe para buscar un ejercicio…"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            style={[styles.search, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
          />
        )}

        {hasExercise && (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Subir" hitSlop={6} disabled={isFirst} onPress={() => onMove(-1)} style={isFirst && styles.dim}>
              <ThemedText style={{ color: theme.textSecondary }}>↑</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Bajar" hitSlop={6} disabled={isLastFilled} onPress={() => onMove(1)} style={isLastFilled && styles.dim}>
              <ThemedText style={{ color: theme.textSecondary }}>↓</ThemedText>
            </Pressable>
          </>
        )}
      </View>

      {!hasExercise && key.length >= MIN_QUERY && (
        <View style={styles.suggestions}>
          {suggestions.map((e) => (
            <Pressable key={e.id} accessibilityRole="button" onPress={() => pick(e)} style={styles.suggestion}>
              <ThemedText>{e.name}</ThemedText>
            </Pressable>
          ))}
          {!exact && (
            <Pressable accessibilityRole="button" onPress={createTyped} style={styles.suggestion}>
              <ThemedText type="small" themeColor="primaryText">
                {creating ? 'Guardando…' : `Añadir «${query.trim()}» como ejercicio nuevo`}
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}

      {hasExercise && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
            <View style={styles.gridLabels}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.gridLabel}>
                REPS
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.gridLabel}>
                KG
              </ThemedText>
            </View>
            {slot.sets.map((set, i) => (
              <View key={i} style={styles.gridCol}>
                <NumberInput
                  compact
                  accessibilityLabel={`Repeticiones de la serie ${i + 1}`}
                  placeholder={`S${i + 1}`}
                  value={set.reps}
                  onChangeText={(t) => setField(i, 'reps', t)}
                />
                <NumberInput
                  compact
                  accessibilityLabel={`Peso de la serie ${i + 1}`}
                  placeholder="kg"
                  value={set.weightKg}
                  onChangeText={(t) => setField(i, 'weightKg', t)}
                />
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Añadir serie"
              onPress={() =>
                // La serie nueva copia la anterior: casi siempre se repite el peso.
                onChange((s) => ({
                  ...s,
                  sets: [...s.sets, { ...(s.sets[s.sets.length - 1] ?? { reps: '', weightKg: '' }) }],
                }))
              }
              style={[styles.addSet, { borderColor: theme.textSecondary }]}>
              <ThemedText themeColor="textSecondary">+</ThemedText>
            </Pressable>
            {slot.sets.length > 1 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quitar última serie"
                hitSlop={6}
                onPress={() => onChange((s) => ({ ...s, sets: s.sets.slice(0, -1) }))}
                style={styles.removeSet}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  −
                </ThemedText>
              </Pressable>
            )}
          </ScrollView>

          <View style={styles.chips}>
            <Chip label="SS" active={slot.linkedToNext} onPress={onToggleSuperset} />
            <Chip
              label="RP"
              active={slot.restPause}
              onPress={() => onChange((s) => ({ ...s, restPause: !s.restPause }))}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  nameInput: { borderRadius: Radius.control, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 15 },
  slot: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, borderRadius: Radius.control, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 15 },
  chosen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.control, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  chosenName: { flex: 1 },
  dim: { opacity: 0.3 },
  suggestions: { marginLeft: 36 },
  suggestion: { paddingVertical: Spacing.two },
  grid: { alignItems: 'flex-start', gap: Spacing.two, paddingLeft: 36 },
  gridLabels: { gap: Spacing.two },
  gridLabel: { height: 42, lineHeight: 42 },
  gridCol: { gap: Spacing.two },
  addSet: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  removeSet: { height: 28, justifyContent: 'center', paddingHorizontal: Spacing.one },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingLeft: 36 },
  rest: { gap: Spacing.two, borderTopWidth: 0 },
  restChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
