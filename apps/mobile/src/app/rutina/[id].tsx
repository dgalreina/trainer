import type { CreateRoutine, Routine } from '@trainer/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Chip, ErrorText, Field, LinkButton, NumberInput } from '@/components/form';
import { ExercisePicker } from '@/components/exercise-picker';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { useExercises } from '@/lib/exercises';
import { useRoutines } from '@/lib/routines';

// El editor trabaja con texto en los campos numéricos y lo convierte al guardar.
interface EditorSet {
  reps: string;
  weightKg: string;
}
interface EditorSlot {
  key: string;
  exerciseId: string;
  sets: EditorSet[];
  linkedToNext: boolean;
  restPause: boolean;
}

let keyCounter = 0;
const newKey = () => `slot-${keyCounter++}`;

const DEFAULT_SETS = 3;
const DEFAULT_REPS = '10';

const toText = (n?: number) => (n === undefined ? '' : String(n));

function toNumber(text: string): number | undefined {
  const value = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function fromRoutine(routine: Routine): EditorSlot[] {
  return routine.slots.map((slot) => ({
    key: newKey(),
    exerciseId: slot.exerciseId,
    sets: slot.sets.map((s) => ({ reps: toText(s.reps), weightKg: toText(s.weightKg) })),
    linkedToNext: slot.linkedToNext,
    restPause: slot.restPause,
  }));
}

export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { routines, loading, save, remove } = useRoutines();
  const { byId } = useExercises();

  const isNew = id === 'nueva';
  const existing = isNew ? undefined : routines.find((r) => r.id === id);

  const [name, setName] = useState('');
  const [slots, setSlots] = useState<EditorSlot[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El formulario se rellena una sola vez, cuando la rutina está disponible.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !existing) return;
    initialized.current = true;
    setName(existing.name);
    setSlots(fromRoutine(existing));
  }, [existing]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/rutinas'));

  const updateSlot = (key: string, change: (slot: EditorSlot) => EditorSlot) =>
    setSlots((prev) => prev.map((s) => (s.key === key ? change(s) : s)));

  const moveSlot = (index: number, delta: -1 | 1) =>
    setSlots((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) return setError('Ponle un nombre a la rutina');
    if (slots.length === 0) return setError('Añade al menos un ejercicio');

    const payload: CreateRoutine = {
      name: trimmed,
      slots: slots.map((slot, index) => ({
        exerciseId: slot.exerciseId,
        sets: slot.sets.map((s) => {
          const reps = toNumber(s.reps);
          return { reps: reps === undefined ? undefined : Math.round(reps), weightKg: toNumber(s.weightKg) };
        }),
        // El último no puede ir encadenado con "el siguiente".
        linkedToNext: index < slots.length - 1 && slot.linkedToNext,
        restPause: slot.restPause,
      })),
    };

    setSaving(true);
    setError(null);
    try {
      await save(isNew ? null : id, payload);
      goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!existing) return;
    const ok = await confirmAction(
      'Borrar rutina',
      `Se borrará «${existing.name}». Los entrenos ya registrados no se tocan.`,
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

  const back = <LinkButton title="Atrás" onPress={goBack} />;

  if (!isNew && !existing) {
    return (
      <Screen title="Rutina" stacked action={back}>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <ThemedText themeColor="textSecondary">No se ha encontrado esta rutina.</ThemedText>
        )}
      </Screen>
    );
  }

  return (
    <Screen title={isNew ? 'Nueva rutina' : 'Editar rutina'} stacked action={back}>
      <Field label="Nombre" value={name} onChangeText={setName} placeholder="Pecho, Espalda, Pierna…" />

      {slots.map((slot, index) => {
        const exercise = byId.get(slot.exerciseId);
        const isLast = index === slots.length - 1;
        return (
          <Card key={slot.key} style={styles.slot}>
            <View style={styles.slotHeader}>
              <ThemedText type="smallBold" style={styles.slotName}>
                {exercise?.name ?? 'Ejercicio eliminado'}
              </ThemedText>
              <IconAction label="Subir" glyph="↑" onPress={() => moveSlot(index, -1)} disabled={index === 0} />
              <IconAction label="Bajar" glyph="↓" onPress={() => moveSlot(index, 1)} disabled={isLast} />
              <IconAction
                label="Quitar ejercicio"
                glyph="✕"
                onPress={() => setSlots((prev) => prev.filter((s) => s.key !== slot.key))}
              />
            </View>

            {slot.sets.map((set, setIndex) => (
              <View key={setIndex} style={styles.setRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.setLabel}>
                  {setIndex + 1}
                </ThemedText>
                <NumberInput
                  accessibilityLabel={`Peso de la serie ${setIndex + 1}`}
                  placeholder="kg"
                  value={set.weightKg}
                  onChangeText={(text) =>
                    updateSlot(slot.key, (s) => ({
                      ...s,
                      sets: s.sets.map((x, i) => (i === setIndex ? { ...x, weightKg: text } : x)),
                    }))
                  }
                />
                <ThemedText themeColor="textSecondary">×</ThemedText>
                <NumberInput
                  accessibilityLabel={`Repeticiones de la serie ${setIndex + 1}`}
                  placeholder="reps"
                  value={set.reps}
                  onChangeText={(text) =>
                    updateSlot(slot.key, (s) => ({
                      ...s,
                      sets: s.sets.map((x, i) => (i === setIndex ? { ...x, reps: text } : x)),
                    }))
                  }
                />
                <IconAction
                  label={`Quitar serie ${setIndex + 1}`}
                  glyph="✕"
                  disabled={slot.sets.length === 1}
                  onPress={() =>
                    updateSlot(slot.key, (s) => ({ ...s, sets: s.sets.filter((_, i) => i !== setIndex) }))
                  }
                />
              </View>
            ))}

            <LinkButton
              title="+ Serie"
              onPress={() =>
                // La serie nueva copia la anterior: casi siempre se repite el peso.
                updateSlot(slot.key, (s) => ({
                  ...s,
                  sets: [...s.sets, { ...(s.sets[s.sets.length - 1] ?? { reps: DEFAULT_REPS, weightKg: '' }) }],
                }))
              }
            />

            <View style={styles.chips}>
              {!isLast && (
                <Chip
                  label="Superserie con el siguiente"
                  active={slot.linkedToNext}
                  onPress={() => updateSlot(slot.key, (s) => ({ ...s, linkedToNext: !s.linkedToNext }))}
                />
              )}
              <Chip
                label="Rest-pause"
                active={slot.restPause}
                onPress={() => updateSlot(slot.key, (s) => ({ ...s, restPause: !s.restPause }))}
              />
            </View>
          </Card>
        );
      })}

      <Button variant="secondary" title="Añadir ejercicio" onPress={() => setPicking(true)} />
      <ErrorText message={error} />
      <Button title="Guardar rutina" onPress={onSave} loading={saving} />
      {!isNew && <Button variant="danger" title="Borrar rutina" onPress={onDelete} />}

      <ExercisePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={(exercise) => {
          setPicking(false);
          setSlots((prev) => [
            ...prev,
            {
              key: newKey(),
              exerciseId: exercise.id,
              sets: Array.from({ length: DEFAULT_SETS }, () => ({ reps: DEFAULT_REPS, weightKg: '' })),
              linkedToNext: false,
              restPause: false,
            },
          ]);
        }}
      />
    </Screen>
  );
}

function IconAction({
  label,
  glyph,
  onPress,
  disabled,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.icon, disabled && styles.iconDisabled]}>
      <ThemedText style={{ color: theme.textSecondary }}>{glyph}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { gap: Spacing.two + 2 },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  slotName: { flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  setLabel: { width: 24, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  icon: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  iconDisabled: { opacity: 0.3 },
});
