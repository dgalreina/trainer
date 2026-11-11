import {
  exerciseNameKey,
  legacyTechnique,
  REST_SECONDS_OPTIONS,
  TECHNIQUES,
  TECHNIQUE_LABELS,
  type Exercise,
  type Routine,
  type Technique,
  type UpdateRoutine,
} from '@trainer/shared';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ExercisePicker } from '@/components/exercise-picker';
import { Chip, NumberInput } from '@/components/form';
import { useScrollControl } from '@/components/scroll-control';
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
  /** Técnica especial; sin ella, serie normal. */
  technique?: Technique;
  /** Descanso propio del ejercicio; sin él, el de la rutina. */
  restSeconds?: number;
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
      technique: slot.technique ?? legacyTechnique(slot as { linkedToNext?: boolean; restPause?: boolean }),
      restSeconds: slot.restSeconds,
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
      technique: slot.technique === 'ss' && index === filled.length - 1 ? undefined : slot.technique,
      restSeconds: slot.restSeconds,
      notes: slot.notes?.trim() || undefined,
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
      if (at > 0 && prev[at - 1].technique === 'ss' && next[at - 1]) {
        next[at - 1] = { ...next[at - 1], technique: undefined };
      }
      return withTrailingEmpty(next);
    });

  // ── Arrastre para reordenar ──────────────────────────────────────────────────────────────────────────
  // Cómo funciona (lo básico de un arrastre bien hecho):
  //  · La tarjeta agarrada sigue al dedo exactamente, también cuando la página se desplaza sola.
  //  · Las demás se apartan con una animación corta en cuanto la tarjeta cruza la mitad de la vecina, y dejan
  //    el hueco justo (alto de la tarjeta + el espacio entre tarjetas), sea cual sea su tamaño.
  //  · Con el dedo cerca del borde de arriba o de abajo, la página se desplaza sola, más rápido cuanto más cerca.
  //  · Al soltar, la tarjeta se asienta en su hueco con una animación y entonces se reordena la lista.
  // Nada de esto pasa por el estado de React mientras se arrastra: son valores animados y refs.
  const scroll = useScrollControl();
  // Solo se guardan las alturas: onLayout avisa cuando cambia el tamaño de una tarjeta, pero no cuando solo
  // cambia su posición (por ejemplo, al crecer la de arriba), así que las posiciones se calculan sumando alturas.
  const heights = useRef(new Map<string, number>());
  const offsets = useRef(new Map<string, Animated.Value>());
  const offsetOf = (key: string) => {
    let value = offsets.current.get(key);
    if (!value) {
      value = new Animated.Value(0);
      offsets.current.set(key, value);
    }
    return value;
  };
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragRef = useRef<{
    key: string;
    from: number;
    target: number;
    gestureDy: number;
    fingerY: number | null;
    scrollY0: number;
    viewport: { top: number; bottom: number } | null;
    frame: number | null;
    dropping: boolean;
  } | null>(null);

  // Tras reordenar (o editar) cada tarjeta ya está en su sitio natural: se borran los desplazamientos.
  useLayoutEffect(() => {
    if (dragRef.current) return;
    offsets.current.forEach((value) => value.setValue(0));
  }, [slots]);
  useEffect(
    () => () => {
      const st = dragRef.current;
      if (st?.frame != null) cancelAnimationFrame(st.frame);
    },
    [],
  );

  /** Posición y alto de cada tarjeta en el orden actual, con el espacio fijo que las separa. */
  const boxes = () => {
    const out = new Map<string, { y: number; h: number }>();
    let y = 0;
    for (const slot of slotsRef.current) {
      const h = heights.current.get(slot.key) ?? 0;
      out.set(slot.key, { y, h });
      y += h + Spacing.three;
    }
    return out;
  };

  /** Posición a la que iría la tarjeta si se soltara ahora: solo entre los ejercicios rellenos. */
  const targetFor = (from: number, dyTotal: number): number => {
    const list = slotsRef.current;
    const all = boxes();
    const box = all.get(list[from].key);
    if (!box) return from;
    const top = box.y + dyTotal;
    const bottom = top + box.h;
    const lastFilled = list.reduce((last, s, i) => (s.exerciseId !== null ? i : last), 0);
    let target = from;
    // Hacia arriba: cuando el borde de arriba de la tarjeta pasa de la mitad de la vecina, se coloca delante.
    for (let i = from - 1; i >= 0; i--) {
      const other = all.get(list[i].key);
      if (other && top < other.y + other.h / 2) target = i;
      else break;
    }
    // Hacia abajo: lo mismo con el borde de abajo.
    if (target === from) {
      for (let i = from + 1; i <= lastFilled; i++) {
        const other = all.get(list[i].key);
        if (other && bottom > other.y + other.h / 2) target = i;
        else break;
      }
    }
    return target;
  };

  /** Aparta (con animación) las tarjetas que quedan entre el origen y el destino. */
  const makeRoom = (from: number, target: number) => {
    const list = slotsRef.current;
    const box = boxes().get(list[from].key);
    if (!box) return;
    const room = box.h + Spacing.three;
    list.forEach((slot, i) => {
      if (i === from) return;
      let shift = 0;
      if (from < target && i > from && i <= target) shift = -room;
      else if (from > target && i >= target && i < from) shift = room;
      Animated.timing(offsetOf(slot.key), { toValue: shift, duration: 140, useNativeDriver: false }).start();
    });
  };

  /** Coloca la tarjeta bajo el dedo y recalcula el destino. Se llama al mover el dedo y en cada fotograma. */
  const followFinger = () => {
    const st = dragRef.current;
    if (!st || st.dropping) return;
    const dyTotal = st.gestureDy + ((scroll?.getMetrics().y ?? 0) - st.scrollY0);
    offsetOf(st.key).setValue(dyTotal);
    const target = targetFor(st.from, dyTotal);
    if (target !== st.target) {
      st.target = target;
      makeRoom(st.from, target);
    }
  };

  /** Desplaza la página si el dedo está cerca del borde de arriba o de abajo del área visible. */
  const autoScroll = () => {
    const st = dragRef.current;
    if (!st || !scroll || !st.viewport || st.fingerY === null) return;
    const zone = 110;
    let speed = 0;
    if (st.fingerY < st.viewport.top + zone) speed = -(1 - Math.max(0, st.fingerY - st.viewport.top) / zone);
    else if (st.fingerY > st.viewport.bottom - zone) speed = 1 - Math.max(0, st.viewport.bottom - st.fingerY) / zone;
    if (speed === 0) return;
    const m = scroll.getMetrics();
    const next = Math.min(Math.max(m.y + speed * 18, 0), Math.max(0, m.content - m.view));
    if (next !== m.y) scroll.scrollTo(next);
  };

  const startDrag = (key: string, fingerY: number) => {
    if (dragRef.current) return;
    const from = slotsRef.current.findIndex((s) => s.key === key);
    if (from < 0) return;
    const st = {
      key,
      from,
      target: from,
      gestureDy: 0,
      fingerY,
      scrollY0: scroll?.getMetrics().y ?? 0,
      viewport: null as { top: number; bottom: number } | null,
      frame: null as number | null,
      dropping: false,
    };
    dragRef.current = st;
    setDraggingKey(key);
    scroll?.measureViewport().then((viewport) => {
      st.viewport = viewport;
    });
    const tick = () => {
      if (dragRef.current !== st || st.dropping) return;
      autoScroll();
      followFinger();
      st.frame = requestAnimationFrame(tick);
    };
    st.frame = requestAnimationFrame(tick);
  };

  const moveDrag = (dy: number, fingerY: number) => {
    const st = dragRef.current;
    if (!st) return;
    st.gestureDy = dy;
    st.fingerY = fingerY;
    followFinger();
  };

  const endDrag = (dy: number) => {
    const st = dragRef.current;
    if (!st || st.dropping) return;
    st.gestureDy = dy;
    followFinger();
    st.dropping = true;
    if (st.frame != null) cancelAnimationFrame(st.frame);

    // Asiento: la tarjeta va a su hueco (arriba del hueco si sube; abajo del hueco si baja).
    const list = slotsRef.current;
    const all = boxes();
    const box = all.get(st.key);
    const dest = all.get(list[st.target]?.key ?? '');
    let settle = 0;
    if (box && dest) settle = st.target < st.from ? dest.y - box.y : dest.y + dest.h - box.h - box.y;
    const { key, from, target } = st;
    Animated.timing(offsetOf(key), { toValue: settle, duration: 140, useNativeDriver: false }).start(() => {
      dragRef.current = null;
      setDraggingKey(null);
      if (from === target) {
        offsets.current.forEach((value) => value.setValue(0));
        return;
      }
      setSlots((prev) => {
        const at = prev.findIndex((s) => s.key === key);
        if (at < 0) return prev;
        const next = [...prev];
        const [moved] = next.splice(at, 1);
        next.splice(target, 0, moved);
        // Las superseries dependen de quién queda a continuación: se sueltan las que tocan el movimiento.
        const touched = new Set([key, prev[at - 1]?.key, next[target - 1]?.key]);
        return next.map((s) => (touched.has(s.key) && s.technique === 'ss' ? { ...s, technique: undefined } : s));
      });
    });
  };

  // «SS»: encadena con el siguiente y deja un hueco justo detrás para continuar la cadena.
  const toggleSuperset = (key: string) =>
    setSlots((prev) => {
      const at = prev.findIndex((s) => s.key === key);
      if (at < 0) return prev;
      const next = [...prev];
      if (next[at].technique === 'ss') {
        next[at] = { ...next[at], technique: undefined };
      } else {
        next[at] = { ...next[at], technique: 'ss' };
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
        autoCapitalize="sentences"
        placeholder="Pecho + Espalda, Pierna…"
        placeholderTextColor={theme.textSecondary}
        style={[styles.nameInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />

      {slots.map((slot, at) => {
        const dragging = draggingKey === slot.key;
        return (
          <Animated.View
            key={slot.key}
            onLayout={(e) => heights.current.set(slot.key, e.nativeEvent.layout.height)}
            style={[styles.slotWrap, dragging && styles.slotDragging, { transform: [{ translateY: offsetOf(slot.key) }] }]}>
            {/* Al arrastrar, la tarjeta lleva un fondo sólido y redondeado que tapa lo de debajo. */}
            {dragging && <View pointerEvents="none" style={[styles.dragCard, { backgroundColor: theme.background }]} />}
            <SlotRow
              slot={slot}
              label={String(at + 1)}
              onChange={(change) => updateSlot(slot.key, change)}
              onPick={(exercise) => updateSlot(slot.key, (s) => ({ ...s, exerciseId: exercise.id }))}
              onRemove={() => removeSlot(slot.key)}
              onDragStart={(fingerY) => startDrag(slot.key, fingerY)}
              onDragMove={moveDrag}
              onDragEnd={endDrag}
              onToggleSuperset={() => toggleSuperset(slot.key)}
              routineRest={restSeconds}
              exerciseName={slot.exerciseId ? (byId.get(slot.exerciseId)?.name ?? 'Ejercicio eliminado') : ''}
            />
          </Animated.View>
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
  routineRest,
}: {
  slot: EditorSlot;
  label: string;
  exerciseName: string;
  onChange: (change: (slot: EditorSlot) => EditorSlot) => void;
  onPick: (exercise: Exercise) => void;
  onRemove: () => void;
  /** `fingerY`: posición vertical del dedo en la ventana; `dy`: lo que se ha movido desde que se agarró el asa. */
  onDragStart: (fingerY: number) => void;
  onDragMove: (dy: number, fingerY: number) => void;
  onDragEnd: (dy: number) => void;
  onToggleSuperset: () => void;
  /** Descanso de la rutina: el que se hereda si el ejercicio no tiene uno propio. */
  routineRest: number;
}) {
  const theme = useTheme();
  const { exercises, create } = useExercises();
  const [noteOpen, setNoteOpen] = useState(Boolean(slot.notes));
  const [restOpen, setRestOpen] = useState(false);
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
        onPanResponderGrant: (_e, g) => dragCallbacks.current.onDragStart(g.y0),
        onPanResponderMove: (_e, g) => dragCallbacks.current.onDragMove(g.dy, g.moveY),
        onPanResponderRelease: (_e, g) => dragCallbacks.current.onDragEnd(g.dy),
        // Si el sistema interrumpe el gesto, la tarjeta se queda donde estaba el dedo (no vuelve de golpe).
        onPanResponderTerminate: (_e, g) => dragCallbacks.current.onDragEnd(g.dy),
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
            <GridButton label="Cambiar ejercicio" onPress={() => setPicking(true)} />
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
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundSelected }]}>
            <GridButton label="Ver todos los ejercicios por grupo muscular" onPress={() => setPicking(true)} />
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

          <ChipRow>
            {/* Una sola técnica a la vez: elegir otra quita la anterior; pulsar la activa, la quita. */}
            {TECHNIQUES.map((technique) => (
              <Chip
                compact
                key={technique}
                label={technique.toUpperCase()}
                active={slot.technique === technique}
                onPress={() =>
                  technique === 'ss'
                    ? onToggleSuperset()
                    : onChange((s) => ({ ...s, technique: s.technique === technique ? undefined : technique }))
                }
              />
            ))}
            <Chip compact label="Nota" active={Boolean(slot.notes)} onPress={() => setNoteOpen((open) => !open)} />
            <Chip
              compact
              label={slot.restSeconds === undefined ? 'Descanso' : slot.restSeconds === 0 ? 'Sin descanso' : `${slot.restSeconds} s`}
              active={slot.restSeconds !== undefined}
              onPress={() => setRestOpen((open) => !open)}
            />
          </ChipRow>
          {slot.technique && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.techniqueHint}>
              {TECHNIQUE_LABELS[slot.technique]}
              {slot.technique === 'ss' ? ': encadenado con el siguiente ejercicio' : ''}
            </ThemedText>
          )}
          {noteOpen && (
            <TextInput
              accessibilityLabel="Nota del ejercicio"
              value={slot.notes ?? ''}
              onChangeText={(text) => onChange((s) => ({ ...s, notes: text }))}
              multiline
              maxLength={500}
              placeholder="Nota: al fallo, tempo, agarre…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.noteInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            />
          )}
          {restOpen && (
            <ChipRow>
              <Chip compact label="Rutina" active={slot.restSeconds === undefined} onPress={() => onChange((s) => ({ ...s, restSeconds: undefined }))} />
              {REST_SECONDS_OPTIONS.map((seconds) => (
                <Chip
                  compact
                  key={seconds}
                  label={seconds === 0 ? 'Sin' : String(seconds)}
                  active={slot.restSeconds === seconds}
                  onPress={() => onChange((s) => ({ ...s, restSeconds: seconds }))}
                />
              ))}
            </ChipRow>
          )}
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

/** Una fila de chips siempre en una sola línea; si no caben, se desplaza en horizontal. */
function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
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
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.control, paddingLeft: Spacing.three },
  search: { flex: 1, paddingRight: Spacing.three, paddingVertical: Spacing.two, fontSize: 16, paddingLeft: 0 },
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
  // Centrados en vertical con el campo de repeticiones (alto 42): (42 − 28) / 2.
  addSet: { width: 28, height: 28, marginTop: 7, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  removeSet: { height: 28, marginTop: 7, justifyContent: 'center', paddingHorizontal: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingLeft: 36 },
  chipScroll: { marginLeft: 36, flexGrow: 0 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  techniqueHint: { paddingLeft: 36 },
  noteInput: { marginLeft: 36, borderRadius: Radius.control, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 15, minHeight: 40 },
  rest: { gap: Spacing.two, borderTopWidth: 0 },
  restChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
