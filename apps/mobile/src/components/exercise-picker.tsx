import { type Exercise, type ExerciseCategory } from '@trainer/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ExerciseMotion } from '@/components/exercise-motion';
import { FadingScroll } from '@/components/fading-scroll';
import { Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/categories';
import { useExercises } from '@/lib/exercises';
import { exerciseFrames } from '@/lib/exercise-images';
import { searchExercises } from '@/lib/exercise-search';

/** Cuántas ilustraciones se mueven a la vez: las primeras que se ven enteras en pantalla. */
const ANIMATED_TILES = 4;

/**
 * Selector de ejercicio a pantalla completa para cuando no te sabes el nombre: los ejercicios
 * separados por grupo muscular, en cuadrícula con su ilustración.
 */
export function ExercisePicker({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.root}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Elegir ejercicio</ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={10}>
              <ThemedText type="linkPrimary">Cerrar</ThemedText>
            </Pressable>
          </View>
          <ExerciseBrowser active={visible} onPick={onSelect} />
        </View>
      </ThemedView>
    </Modal>
  );
}

/**
 * Buscador + botones por grupo + cuadrícula de ejercicios con ilustración. Lo usan el selector
 * (`onPick`) y el catálogo (`onRemove`: una ✕ en los ejercicios creados a mano).
 */
export function ExerciseBrowser({
  active = true,
  onPick,
  onRemove,
  placeholder = 'Press banca, sentadilla…',
  extra,
}: {
  active?: boolean;
  onPick?: (exercise: Exercise) => void;
  onRemove?: (exercise: Exercise) => void;
  placeholder?: string;
  /** Contenido entre los botones de grupo y la lista (por ejemplo, «Crear…»). */
  extra?: (query: string) => ReactNode;
}) {
  const { exercises } = useExercises();
  const [query, setQuery] = useState('');
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const theme = useTheme();

  const groups = useMemo(() => {
    const found = query.trim() ? searchExercises(exercises, query, 60) : exercises;
    return CATEGORIES.map((category) => ({
      category,
      items: found.filter((e) => e.category === category),
    })).filter((g) => g.items.length > 0);
  }, [exercises, query]);

  // Se mueven las primeras ilustraciones que se ven ENTERAS en pantalla (no las primeras de la lista):
  // al hacer scroll cambian. Las posiciones se miden con onLayout (grupo + cuadrícula + recuadro).
  const [animated, setAnimated] = useState<Set<string>>(new Set());
  const scroll = useRef({ y: 0, height: 0 });
  const boxes = useRef({
    group: new Map<string, number>(),
    grid: new Map<string, number>(),
    tile: new Map<string, { y: number; h: number }>(),
  });

  const recompute = useCallback(() => {
    const { y, height } = scroll.current;
    if (height <= 0) return;
    const next = new Set<string>();
    for (const group of groups) {
      const base = (boxes.current.group.get(group.category) ?? 0) + (boxes.current.grid.get(group.category) ?? 0);
      for (const e of group.items) {
        if (next.size >= ANIMATED_TILES) break;
        const tile = boxes.current.tile.get(e.id);
        if (!tile || !exerciseFrames(e.name)) continue;
        const top = base + tile.y;
        if (top >= y - 1 && top + tile.h <= y + height + 1) next.add(e.id);
      }
    }
    setAnimated((prev) => (prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next));
  }, [groups]);

  // Los cambios de layout llegan en ráfaga: se recalcula una vez al final.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(recompute, 30);
  }, [recompute]);
  useEffect(() => {
    schedule();
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, [schedule, active]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scroll.current.y = e.nativeEvent.contentOffset.y;
    schedule();
  };
  const onScrollLayout = (e: LayoutChangeEvent) => {
    scroll.current.height = e.nativeEvent.layout.height;
    schedule();
  };

  const track = useMemo(
    () => ({
      group: (category: string, y: number) => {
        boxes.current.group.set(category, y);
        schedule();
      },
      grid: (category: string, y: number) => {
        boxes.current.grid.set(category, y);
        schedule();
      },
      tile: (id: string, y: number, h: number) => {
        boxes.current.tile.set(id, { y, h });
        schedule();
      },
    }),
    [schedule],
  );

  /** Salta directo a la sección de un grupo muscular. */
  function goTo(category: string) {
    const y = boxes.current.group.get(category);
    if (y !== undefined) listRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
  }

  function pick(exercise: Exercise) {
    setQuery('');
    onPick?.(exercise);
  }

  return (
    <>
      <Field
        accessibilityLabel="Buscar ejercicio"
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        autoCapitalize="none"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}>
        {groups.map((group) => (
          <Pressable
            key={group.category}
            accessibilityRole="button"
            accessibilityLabel={`Ir a ${CATEGORY_LABELS[group.category]}`}
            onPress={() => goTo(group.category)}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: theme.primary, backgroundColor: pressed ? theme.primarySoft : theme.background, WebkitTapHighlightColor: 'transparent' } as object,
            ]}>
            <ThemedText type="smallBold">{CATEGORY_LABELS[group.category]}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {extra?.(query)}

      <FadingScroll
        scrollRef={listRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        onScroll={onScroll}
        onLayout={onScrollLayout}>
        {groups.length === 0 && (
          <ThemedText themeColor="textSecondary">No hay ejercicios con ese nombre.</ThemedText>
        )}
        {groups.map((group) => (
          <Group key={group.category} category={group.category} items={group.items} animated={animated} track={track} onPick={pick} onRemove={onRemove} />
        ))}
      </FadingScroll>
    </>
  );
}

const frames = exerciseFrames;

function Group({
  category,
  items,
  animated,
  track,
  onPick,
  onRemove,
}: {
  category: ExerciseCategory;
  items: Exercise[];
  animated: Set<string>;
  track: {
    group: (category: string, y: number) => void;
    grid: (category: string, y: number) => void;
    tile: (id: string, y: number, h: number) => void;
  };
  onPick: (exercise: Exercise) => void;
  onRemove?: (exercise: Exercise) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group} onLayout={(e) => track.group(category, e.nativeEvent.layout.y)}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {CATEGORY_LABELS[category]}
      </ThemedText>
      <View style={styles.grid} onLayout={(e) => track.grid(category, e.nativeEvent.layout.y)}>
        {items.map((exercise) => (
          <Pressable
            key={exercise.id}
            accessibilityRole="button"
            accessibilityLabel={exercise.name}
            onLayout={(e) => track.tile(exercise.id, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
            onPress={() => onPick(exercise)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: theme.background, borderColor: theme.primary, WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', userSelect: 'none' } as object,
              pressed && { backgroundColor: theme.primarySoft },
            ]}>
            {frames(exercise.name) && (
              <ExerciseMotion frames={frames(exercise.name)!} animate={animated.has(exercise.id)} style={styles.image} />
            )}
            <ThemedText type="smallBold" numberOfLines={3}>
              {exercise.name}
            </ThemedText>
            {onRemove && exercise.ownerId && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Borrar ${exercise.name}`}
                onPress={() => onRemove(exercise)}
                hitSlop={8}
                style={styles.remove}>
                <ThemedText type="smallBold" themeColor="textSecondary">✕</ThemedText>
              </Pressable>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: Spacing.two, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: Radius.control, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  list: { gap: Spacing.four, paddingBottom: Spacing.five },
  group: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    width: '48.5%',
    minHeight: 84,
    borderRadius: Radius.control,
    borderWidth: 1,
    padding: Spacing.three,
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  image: { borderRadius: Radius.control },
  remove: { position: 'absolute', top: Spacing.two, right: Spacing.three, padding: Spacing.one },
});
