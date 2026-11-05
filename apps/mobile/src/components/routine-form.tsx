import {
  exerciseNameKey,
  REST_SECONDS_OPTIONS,
  type Exercise,
  type Routine,
  type UpdateRoutine,
} from '@trainer/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ExercisePicker } from '@/components/exercise-picker';
import { Chip, NumberInput } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useExercises } from '@/lib/exercises';
import { searchExercises } from '@/lib/exercise-search';

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

  // Arrastre vertical: la posición y la altura de cada ejercicio se miden con onLayout, y mientras se
  // arrastra el asa solo se mueve la tarjeta del dedo (los demás se apartan como vista previa).
  const layouts = useRef(new Map<string, { y: number; h: number }>());
  const [drag, setDrag] = useState<{ key: string; dy: number } | null>(null);

  /** Hacia qué posición iría el ejercicio arrastrado si se soltara ahora (solo entre los rellenos). */
  const dropIndex = (key: string, dy: number) => {
    const from = slots.findIndex((s) => s.key === key);
    const box = layouts.current.get(key);
    if (from < 0 || !box) return from;
    const center = box.y + box.h / 2 + dy;
    const lastFilled = slots.reduce((last, s, i) => (s.exerciseId !== null ? i : last), 0);
    let target = 0;
    for (let i = 0; i <= lastFilled; i++) {
      const other = layouts.current.get(slots[i].key);
      if (other && center >= other.y + other.h / 2) target = i;
    }
    return target;
  };

  const dropSlot = (key: string, dy: number) => {
    const to = dropIndex(key, dy);
    setDrag(null);
    setSlots((prev) => {
      const from = prev.findIndex((s) => s.key === key);
      if (from < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Las superseries dependen de quién queda a continuación: se sueltan las que tocan el movimiento.
      const touched = new Set([key, prev[from - 1]?.key, next[to - 1]?.key]);
      return next.map((s) => (touched.has(s.key) && s.linkedToNext ? { ...s, linkedToNext: false } : s));
    });
  };

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

      {slots.map((slot, at) => {
        // Vista previa mientras se arrastra: los que quedan entre origen y destino se apartan.
        let shift = 0;
        let dragging = false;
        if (drag) {
          const from = slots.findIndex((s) => s.key === drag.key);
          const to = dropIndex(drag.key, drag.dy);
          const moved = layouts.current.get(drag.key);
          if (slot.key === drag.key) {
            dragging = true;
            shift = drag.dy;
          } else if (moved) {
            if (from < to && at > from && at <= to) shift = -moved.h;
            else if (from > to && at >= to && at < from) shift = moved.h;
          }
        }
        return (
          <View
            key={slot.key}
            onLayout={(e) => layouts.current.set(slot.key, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
            style={[styles.slotWrap, dragging && styles.slotDragging, { transform: [{ translateY: shift }] }]}>
            {/* Al arrastrar, la tarjeta lleva un fondo sólido y redondeado que tapa lo de debajo. */}
            {dragging && <View pointerEvents="none" style={[styles.dragCard, { backgroundColor: theme.background }]} />}
            <SlotRow
              slot={slot}
              label={String(at + 1)}
              onChange={(change) => updateSlot(slot.key, change)}
              onPick={(exercise) => updateSlot(slot.key, (s) => ({ ...s, exerciseId: exercise.id }))}
              onRemove={() => removeSlot(slot.key)}
              onDragStart={() => setDrag({ key: slot.key, dy: 0 })}
              onDragMove={(dy) => setDrag({ key: slot.key, dy })}
              onDragEnd={(dy) => dropSlot(slot.key, dy)}
              onToggleSuperset={() => toggleSuperset(slot.key)}
              exerciseName={slot.exerciseId ? (byId.get(slot.exerciseId)?.name ?? 'Ejercicio eliminado') : ''}
            />
          </View>
        );
      })}

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
  onChange,
  onPick,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
  onToggleSuperset,
}: {
  slot: EditorSlot;
  label: string;
  exerciseName: string;
  onChange: (change: (slot: EditorSlot) => EditorSlot) => void;
  onPick: (exercise: Exercise) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: (dy: number) => void;
  onToggleSuperset: () => void;
}) {
  const theme = useTheme();
  const { exercises, create } = useExercises();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [picking, setPicking] = useState(false);

  // Los callbacks cambian en cada render: el gesto usa siempre los últimos.
  const dragCallbacks = useRef({ onDragStart, onDragMove, onDragEnd });
  dragCallbacks.current = { onDragStart, onDragMove, onDragEnd };
  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Una vez agarrada el asa, el scroll de la página no se la puede quitar.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => dragCallbacks.current.onDragStart(),
        onPanResponderMove: (_e, g) => dragCallbacks.current.onDragMove(g.dy),
        onPanResponderRelease: (_e, g) => dragCallbacks.current.onDragEnd(g.dy),
        onPanResponderTerminate: () => dragCallbacks.current.onDragEnd(0),
      }),
    [],
  );

  const key = exerciseNameKey(query);
  const suggestions = key.length >= MIN_QUERY ? searchExercises(exercises, query, MAX_SUGGESTIONS) : [];
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
            <GridButton label="Cambiar ejercicio" onPress={() => setPicking(true)} />
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
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundSelected }]}>
            <TextInput
              accessibilityLabel="Buscar ejercicio"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => (suggestions[0] ? pick(suggestions[0]) : createTyped())}
              placeholder="Escribe para buscar un ejercicio…"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              style={[styles.search, { color: theme.text }]}
            />
            <GridButton label="Ver todos los ejercicios por grupo muscular" onPress={() => setPicking(true)} />
          </View>
        )}

        {hasExercise && (
          // Asa de tres rayas: se arrastra en vertical para cambiar el orden.
          <View
            accessibilityLabel="Arrastrar para reordenar"
            {...handlePan.panHandlers}
            style={[styles.handle, { touchAction: 'none' } as object]}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.handleBar, { backgroundColor: theme.textSecondary }]} />
            ))}
          </View>
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
          <View style={styles.gridRow}>
            {/* Las etiquetas quedan fijas; solo las series se desplazan en horizontal. */}
            <View style={styles.gridLabels}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.gridLabel}>
                REPS
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.gridLabel}>
                KG
              </ThemedText>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.gridScroll}
              contentContainerStyle={styles.grid}>
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
          </View>

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
      <ExercisePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={(exercise) => {
          setPicking(false);
          pick(exercise);
        }}
      />
    </View>
  );
}

/** Botón de cuatro cuadraditos: abre el selector con los ejercicios por grupo muscular. */
function GridButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={styles.gridButton}>
      {[0, 1, 2, 3].map((n) => (
        <View key={n} style={[styles.gridDot, { backgroundColor: theme.textSecondary }]} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  nameInput: { borderRadius: Radius.control, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  slot: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.control, paddingRight: Spacing.three },
  search: { flex: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  gridButton: { width: 21, height: 21, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  gridDot: { width: 9, height: 9, borderRadius: 2.5 },
  chosen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.control, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  chosenName: { flex: 1 },
  slotWrap: { zIndex: 0 },
  slotDragging: { zIndex: 10 },
  dragCard: { position: 'absolute', top: -8, bottom: -8, left: -12, right: -12, borderRadius: Radius.card, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  handle: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center', gap: 4 },
  handleBar: { width: 18, height: 2, borderRadius: 1 },
  suggestions: { marginLeft: 36 },
  suggestion: { paddingVertical: Spacing.two },
  gridRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 36 },
  gridScroll: { flex: 1 },
  // Aire alrededor: el scroll recorta lo que sobresale, y el borde del campo enfocado se cortaba.
  grid: { alignItems: 'flex-start', gap: Spacing.two, padding: 4 },
  gridLabels: { gap: Spacing.two, paddingVertical: 4, width: 52 },
  gridLabel: { height: 42, lineHeight: 42 },
  gridCol: { gap: Spacing.two },
  addSet: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  removeSet: { height: 28, justifyContent: 'center', paddingHorizontal: Spacing.one },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingLeft: 36 },
  rest: { gap: Spacing.two, borderTopWidth: 0 },
  restChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
