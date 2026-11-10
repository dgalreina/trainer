import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { DayEnergy } from '@trainer/shared';

import { DayEnergyChart } from '@/components/day-energy-chart';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatLongDay, formatTime, parseISO, startOfDay } from '@/lib/dates';
import type { DayEvent } from '@/lib/week-events';

const HOUR_HEIGHT = 56;
const LABEL_WIDTH = 48;
// Alto mínimo de cada tipo: un entreno lleva dos líneas de texto; una pesada, una.
const MIN_HEIGHT = { workout: 52, weight: 34, meal: 52, plan: 52 } as const;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * HOUR_MS;
/** Al soltar un evento arrastrado, la hora se ajusta a múltiplos de estos minutos. */
const SNAP_MINUTES = 5;
const DAY_MINUTES = 24 * 60;
const HANDLE_WIDTH = 30;
const EDIT_WIDTH = 34;
/** Alto de la tarjeta «Día X» al empezar cada día y de cada marca que la sigue. */
const DAY_CARD_HEIGHT = 28;
const MARK_HEIGHT = 22;
/** Las tarjetas dejan ver las gráficas de detrás: opacidad de su fondo. */
const CARD_OPACITY = 0.82;
/** Lo mínimo que se ve de una tarjeta pegada al final del día. */
const CARD_MIN_VISIBLE = 24;
/** Al tocar un hueco del día para añadir algo, la hora se redondea hacia abajo a múltiplos de esto. */
const SLOT_MINUTES = 15;

/** Alto de un día entero: sus 24 horas. Es fijo, así la lista sabe dónde está cada día sin medirlos. */
const DAY_HEIGHT = 24 * HOUR_HEIGHT;
/** Días que se pueden recorrer a cada lado de hoy (unos dos años). */
const RADIUS = 730;
const INDEXES = Array.from({ length: RADIUS * 2 + 1 }, (_, i) => i);

/** Un color #RRGGBB con transparencia. */
const withAlpha = (hex: string, alpha: number) =>
  hex.length === 7 ? hex + Math.round(alpha * 255).toString(16).padStart(2, '0') : hex;

/** Días de diferencia entre dos días «AAAA-MM-DD» (con signo). */
const dayDiff = (from: string, to: string) =>
  Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / DAY_MS);

/** Lo que se dibuja en un día: sus tarjetas, sus gráficas y las marcas del principio. */
export interface DayModel {
  events: DayEvent[];
  /** Gasto, consumo y balance del día para las gráficas de fondo; sin él no se dibujan. */
  energy: DayEnergy | null;
  /** Marcas discretas del principio del día («Comienza la dieta…»). */
  marks: string[];
  /** Si ya hay datos de ese día: hasta entonces no se dice que esté vacío. */
  loaded: boolean;
}

interface Placed {
  event: DayEvent;
  column: number;
}

/** Reparte en columnas los eventos que se pisan, para que no se tapen entre sí. */
function placeEvents(events: DayEvent[]): { placed: Placed[]; columns: number } {
  const columnEnds: number[] = [];
  const placed = events.map((event): Placed => {
    const start = event.start.getTime();
    let column = columnEnds.findIndex((end) => end <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    const minMs = (MIN_HEIGHT[event.kind] / HOUR_HEIGHT) * HOUR_MS;
    columnEnds[column] = Math.max(event.end.getTime(), start + minMs);
    return { event, column };
  });
  return { placed, columns: Math.max(1, columnEnds.length) };
}

/**
 * Cuántos minutos se mueve un evento al arrastrarlo `dy` píxeles: en múltiplos de
 * `SNAP_MINUTES` y sin salirse del día.
 */
function dragMinutes(dy: number, event: DayEvent, dayStart: number): number {
  const startMinute = Math.round((event.start.getTime() - dayStart) / MINUTE_MS);
  const wanted = Math.round(((dy / HOUR_HEIGHT) * 60) / SNAP_MINUTES) * SNAP_MINUTES;
  const lowest = -startMinute;
  const highest = DAY_MINUTES - SNAP_MINUTES - startMinute;
  return Math.min(Math.max(wanted, lowest), highest);
}

/** Hora en la que se ha tocado el día, a partir de la altura del toque dentro de las 24 horas. */
function slotAt(event: GestureResponderEvent, dayStart: number): Date {
  // En nativo llega `locationY`; en la web el clic trae `offsetY` (relativo al hueco tocado).
  const native = event.nativeEvent as { locationY?: number; offsetY?: number };
  const y = native.locationY ?? native.offsetY ?? 0;
  const minutes = Math.floor(((y / HOUR_HEIGHT) * 60) / SLOT_MINUTES) * SLOT_MINUTES;
  return new Date(dayStart + Math.min(Math.max(minutes, 0), DAY_MINUTES - SLOT_MINUTES) * MINUTE_MS);
}

/** Lo que se puede pedir a la lista desde fuera. */
export interface DayListHandle {
  /** Lleva el scroll al día indicado, a la hora que interesa (la de ahora si es hoy; las 7 si no). */
  scrollToDay: (day: string, animated?: boolean) => void;
}

interface Handlers {
  onPressEvent?: (event: DayEvent) => void;
  /** Se llama al pulsar el lápiz de una comida. */
  onEditEvent?: (event: DayEvent) => void;
  /** Se llama al soltar un evento arrastrado, con su nueva hora de inicio. */
  onMoveEvent?: (event: DayEvent, newStart: Date) => void;
  /** Se llama al tocar un hueco de un día, con la hora tocada. */
  onPressSlot?: (time: Date) => void;
}

/**
 * Los días uno debajo de otro en un scroll continuo (unos dos años a cada lado de hoy): bajas y entras en el
 * día siguiente, subes y vuelves al anterior. Cada día tiene su tarjeta «Día X» al empezar (a las 00:00), con
 * sus tarjetas, sus gráficas y sus marcas. Pasa por detrás de la barra de pestañas y de la tarjeta de abajo.
 * Avisa de cuál es el día que se está mostrando (el del centro de la zona visible).
 */
export const DayList = forwardRef<
  DayListHandle,
  {
    /** El día de hoy («AAAA-MM-DD»). */
    today: string;
    /** Lo que se pinta en cada día. */
    modelOf: (day: string) => DayModel;
    /** Alto (px) de lo que flota por encima (la barra de pestañas): el día de interés se coloca justo debajo. */
    topInset: number;
    /** Alto (px) de lo que flota por debajo (la tarjeta de calorías): el «centro» de lo visible queda por encima de ella. */
    bottomInset: number;
    /** Se llama cuando cambia el día que se está mostrando. */
    onVisibleDay: (day: string) => void;
  } & Handlers
>(function DayList({ today, modelOf, topInset, bottomInset, onVisibleDay, ...handlers }, ref) {
  const list = useRef<FlatList<number>>(null);
  // El día del que cuelgan los índices: el de hoy al abrir. Si la app sigue abierta pasada la medianoche,
  // los índices no se mueven (solo cambia cuál es «hoy»).
  const anchor = useRef(today);
  const dayOfIndex = useCallback((index: number) => addDays(anchor.current, index - RADIUS), []);

  // Los valores más recientes, para los manejadores que viven toda la vida del componente.
  const latest = useRef({ today, topInset, bottomInset, height: 0, onVisibleDay });
  latest.current.today = today;
  latest.current.topInset = topInset;
  latest.current.bottomInset = bottomInset;
  latest.current.onVisibleDay = onVisibleDay;
  const [height, setHeight] = useState(0);
  const lastIndex = useRef(RADIUS);

  /**
   * El scroll al que hay que ir para ver un día: su hora de interés queda justo bajo la barra de pestañas. Con
   * un tope: el centro de lo visible tiene que seguir cayendo dentro de ese día (si no, por la tarde-noche se
   * acabaría mostrando el día siguiente).
   */
  const offsetOf = useCallback((day: string) => {
    const { topInset: inset, bottomInset: bottom, height: viewport } = latest.current;
    const base = (RADIUS + dayDiff(anchor.current, day)) * DAY_HEIGHT;
    const hour = day === latest.current.today ? Math.max(0, new Date().getHours() - 2) : 7;
    const centre = inset + Math.max(0, viewport - inset - bottom) / 2;
    const wanted = base + hour * HOUR_HEIGHT - inset;
    return Math.max(0, Math.min(Math.max(wanted, base - centre + 1), base + DAY_HEIGHT - centre - 1));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToDay: (day, animated = true) => list.current?.scrollToOffset({ offset: offsetOf(day), animated }),
    }),
    [offsetOf],
  );

  // Al abrir, hoy a la hora que interesa. La lista ya arranca en el día de hoy; esto la afina.
  const placed = useRef(false);
  useEffect(() => {
    if (placed.current || height === 0 || topInset === 0) return;
    // Se da por hecho al disparar, no antes: si las medidas cambian en esos 30 ms, se reprograma.
    const timer = setTimeout(() => {
      placed.current = true;
      list.current?.scrollToOffset({ offset: offsetOf(latest.current.today), animated: false });
    }, 30);
    return () => clearTimeout(timer);
  }, [height, topInset, offsetOf]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { topInset: inset, bottomInset: bottom, height: viewport } = latest.current;
      // El día que se muestra es el del centro de la zona visible (entre la barra de pestañas y la tarjeta de abajo).
      const center = event.nativeEvent.contentOffset.y + inset + Math.max(0, viewport - inset - bottom) / 2;
      const index = Math.min(Math.max(Math.floor(center / DAY_HEIGHT), 0), INDEXES.length - 1);
      if (index !== lastIndex.current) {
        lastIndex.current = index;
        latest.current.onVisibleDay(dayOfIndex(index));
      }
    },
    [dayOfIndex],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    latest.current.height = event.nativeEvent.layout.height;
    setHeight(event.nativeEvent.layout.height);
  }, []);

  const { onPressEvent, onEditEvent, onMoveEvent, onPressSlot } = handlers;
  const renderItem = useCallback(
    ({ item }: { item: number }) => (
      <DayColumn
        day={dayOfIndex(item)}
        today={today}
        modelOf={modelOf}
        onPressEvent={onPressEvent}
        onEditEvent={onEditEvent}
        onMoveEvent={onMoveEvent}
        onPressSlot={onPressSlot}
      />
    ),
    [dayOfIndex, today, modelOf, onPressEvent, onEditEvent, onMoveEvent, onPressSlot],
  );

  return (
    <FlatList
      ref={list}
      data={INDEXES}
      keyExtractor={(index) => String(index)}
      getItemLayout={(_, index) => ({ length: DAY_HEIGHT, offset: DAY_HEIGHT * index, index })}
      initialScrollIndex={RADIUS}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      windowSize={5}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={32}
      onScroll={onScroll}
      onLayout={onLayout}
      nestedScrollEnabled
      // Los días se vuelven a pintar si cambian los datos, el día de hoy o los manejadores (todo cuelga de renderItem).
      extraData={renderItem}
      style={styles.list}
      renderItem={renderItem}
    />
  );
});

/** Un día: sus 24 horas de arriba abajo con lo que pasó en cada una. Los eventos se pueden arrastrar; tocar un hueco propone añadir algo. */
const DayColumn = memo(function DayColumn({
  day,
  today,
  modelOf,
  onPressEvent,
  onEditEvent,
  onMoveEvent,
  onPressSlot,
}: {
  day: string;
  today: string;
  modelOf: (day: string) => DayModel;
} & Handlers) {
  const theme = useTheme();
  const { events, energy, marks, loaded } = useMemo(() => modelOf(day), [modelOf, day]);
  const isToday = day === today;
  const dayStart = startOfDay(day).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [areaWidth, setAreaWidth] = useState(0);

  // La línea de "ahora" avanza cada minuto, solo en el día de hoy.
  useEffect(() => {
    if (!isToday) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, [isToday]);

  const { placed, columns } = useMemo(() => placeEvents(events), [events]);

  const nowTop = ((now - dayStart) / HOUR_MS) * HOUR_HEIGHT;
  // Lo que aún no ha pasado se dibuja tenue: hoy, desde ahora; un día futuro, entero.
  const dimFrom = day > today ? 0 : isToday ? nowTop : DAY_HEIGHT;
  // Debajo de la tarjeta «Día X» y de las marcas, si las hay.
  const labelsBottom = DAY_CARD_HEIGHT + marks.length * MARK_HEIGHT;

  return (
    <View style={styles.day}>
      <View style={styles.grid}>
        {/* Gráficas del día, por debajo de todo lo demás. */}
        <View pointerEvents="none" style={styles.chart}>
          {energy && areaWidth > 0 ? (
            <DayEnergyChart energy={energy} width={areaWidth} height={DAY_HEIGHT} dimFrom={dimFrom} />
          ) : null}
        </View>

        {Array.from({ length: 24 }, (_, hour) => (
          <View key={hour} pointerEvents="none" style={[styles.hourRow, { top: hour * HOUR_HEIGHT }]}>
            <ThemedText type="small" themeColor="textSecondary" style={[styles.hourLabel, hour === 0 && styles.firstHourLabel]}>
              {String(hour).padStart(2, '0')}:00
            </ThemedText>
            <View style={[styles.hourLine, { backgroundColor: theme.backgroundSelected }]} />
          </View>
        ))}

        {/* El principio del día: la tarjeta «Día X» y, debajo, las marcas («Comienza la dieta…»). */}
        <View pointerEvents="none" style={[styles.mark, { top: 0, height: DAY_CARD_HEIGHT }]}>
          <ThemedText
            type="smallBold"
            numberOfLines={1}
            style={[styles.dayCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            {formatLongDay(day)}
            {isToday ? ' · Hoy' : ''}
          </ThemedText>
        </View>
        {marks.map((label, i) => (
          <View key={label} pointerEvents="none" style={[styles.mark, { top: DAY_CARD_HEIGHT + i * MARK_HEIGHT }]}>
            <View style={[styles.markLine, { backgroundColor: theme.primary }]} />
            <ThemedText
              type="small"
              themeColor="primaryText"
              numberOfLines={1}
              style={[styles.markLabel, { backgroundColor: theme.background, borderColor: theme.primary }]}>
              {label}
            </ThemedText>
          </View>
        ))}

        {/* Sin nada registrado, un aviso al principio del día (no capta toques). */}
        {events.length === 0 && loaded && (
          <ThemedText type="small" themeColor="textSecondary" style={[styles.empty, { top: labelsBottom + Spacing.two }]}>
            Nada registrado este día. Toca una hora para añadir algo.
          </ThemedText>
        )}

        {/* Fondo táctil del día: tocar un hueco vacío propone añadir algo a esa hora. */}
        {onPressSlot && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Añadir a esta hora"
            onPress={(e) => onPressSlot(slotAt(e, dayStart))}
            style={styles.slots}
          />
        )}

        {/* Zona de eventos, a la derecha de las horas. Solo las tarjetas capturan el toque. */}
        <View
          pointerEvents="box-none"
          style={styles.events}
          onLayout={(e) => setAreaWidth(e.nativeEvent.layout.width)}>
          {placed.map(({ event, column }) => (
            <EventCard
              key={event.id}
              event={event}
              dayStart={dayStart}
              column={column}
              columns={columns}
              onPress={onPressEvent}
              onEdit={onEditEvent}
              onMove={onMoveEvent}
            />
          ))}
        </View>

        {isToday && nowTop >= 0 && nowTop <= DAY_HEIGHT && (
          <View pointerEvents="none" style={[styles.nowLine, { top: nowTop }]}>
            <View style={[styles.nowDot, { backgroundColor: theme.primary }]} />
            <View style={[styles.nowRule, { backgroundColor: theme.primary }]} />
          </View>
        )}
      </View>
    </View>
  );
});

/**
 * Una tarjeta del calendario. Se toca (las pesadas se pueden borrar) y se mueve arrastrando el
 * asa de la derecha: solo el asa captura el gesto, así que el resto de la tarjeta, y el hueco entre
 * tarjetas, siguen haciendo scroll del día.
 */
function EventCard({
  event,
  dayStart,
  column,
  columns,
  onPress,
  onEdit,
  onMove,
}: {
  event: DayEvent;
  dayStart: number;
  column: number;
  columns: number;
  onPress?: (event: DayEvent) => void;
  onEdit?: (event: DayEvent) => void;
  onMove?: (event: DayEvent, newStart: Date) => void;
}) {
  const theme = useTheme();
  const [dragDy, setDragDy] = useState<number | null>(null);

  // El gesto se crea una sola vez; lee siempre los datos más recientes desde aquí.
  const latest = useRef({ event, dayStart, onMove });
  useEffect(() => {
    latest.current = { event, dayStart, onMove };
  });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Una vez agarrada, nadie (ni el scroll ni el paginador de pestañas) se la quita.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => setDragDy(0),
        onPanResponderMove: (_e, g) => setDragDy(g.dy),
        onPanResponderRelease: (_e, g) => {
          const { event: current, dayStart: start, onMove: move } = latest.current;
          const minutes = dragMinutes(g.dy, current, start);
          setDragDy(null);
          if (minutes !== 0) move?.(current, new Date(current.start.getTime() + minutes * MINUTE_MS));
        },
        onPanResponderTerminate: () => setDragDy(null),
      }),
    [],
  );

  const dragging = dragDy !== null;
  const minutes = dragging ? dragMinutes(dragDy, event, dayStart) : 0;
  const start = new Date(event.start.getTime() + minutes * MINUTE_MS);

  // Una tarjeta no sale por el final de su día (la parte que sobresaldría quedaría tapada por el día siguiente).
  const top = Math.min(
    ((event.start.getTime() - dayStart) / HOUR_MS) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT,
    DAY_HEIGHT - CARD_MIN_VISIBLE,
  );
  const height = Math.min(
    Math.max(MIN_HEIGHT[event.kind], ((event.end.getTime() - event.start.getTime()) / HOUR_MS) * HOUR_HEIGHT - 2),
    DAY_HEIGHT - Math.max(0, top),
  );
  // Salmón para lo que entra (comidas) y azul cielo para lo que se gasta (entrenos).
  const background =
    event.kind === 'meal' || event.kind === 'plan'
      ? theme.primarySoft
      : event.kind === 'workout'
        ? theme.skySoft
        : theme.backgroundElement;
  // Una comida de la dieta se ve y se trata como una comida más: se puede mover y editar, y al hacerlo
  // se crea la versión de ese día sin tocar la dieta.
  const canMove = Boolean(onMove);
  const canEdit = Boolean(onEdit) && (event.kind === 'meal' || event.kind === 'plan');

  return (
    <Pressable
      accessibilityRole={onPress && event.kind === 'weight' ? 'button' : undefined}
      disabled={!onPress || event.kind !== 'weight' || dragging}
      onPress={() => onPress?.(event)}
      style={[
        styles.event,
        {
          top: Math.max(0, top),
          height,
          left: `${(column / columns) * 100}%`,
          width: `${100 / columns}%`,
          backgroundColor: withAlpha(background, CARD_OPACITY),
        },
        dragging && styles.dragging,
      ]}>
      <View style={styles.eventText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {formatTime(start)} · {event.title}
        </ThemedText>
        {event.subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {event.subtitle}
          </ThemedText>
        ) : null}
      </View>
      {canEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Editar ${event.title}`}
          hitSlop={6}
          onPress={() => onEdit?.(event)}
          disabled={dragging}
          style={styles.edit}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
            <Path d="M13.5 6.5l4 4" />
          </Svg>
        </Pressable>
      )}
      {canMove && (
        <View
          accessibilityRole="button"
          accessibilityLabel={`Mover ${event.title}`}
          {...responder.panHandlers}
          // `touch-action: none` en el asa: el navegador no hace scroll mientras se arrastra.
          style={[styles.handle, { touchAction: 'none' } as object]}>
          <ThemedText themeColor="textSecondary" style={styles.grip}>
            ≡
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  // Un día entero: alto fijo y los márgenes laterales de la pantalla.
  day: { height: DAY_HEIGHT, paddingHorizontal: Spacing.four },
  grid: { flex: 1 },
  empty: {
    position: 'absolute',
    left: LABEL_WIDTH,
    right: 0,
    zIndex: 1,
    textAlign: 'center',
    ...({ pointerEvents: 'none' } as object),
  },
  // Una fila del principio del día: la tarjeta «Día X» o una marca, centrada sobre la zona de eventos.
  mark: {
    position: 'absolute',
    left: LABEL_WIDTH,
    right: 0,
    height: MARK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLine: { position: 'absolute', left: 0, right: 0, top: MARK_HEIGHT / 2, height: 1, opacity: 0.45 },
  markLabel: {
    maxWidth: '92%',
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    fontSize: 12,
    lineHeight: 16,
  },
  // La tarjeta «Día X»: pequeña, con el fondo de las tarjetas de la app.
  dayCard: {
    maxWidth: '92%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half + 1,
    borderWidth: 1,
    borderRadius: Radius.control,
    overflow: 'hidden',
    fontSize: 13,
    lineHeight: 18,
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
    flexDirection: 'row',
  },
  hourLabel: { width: LABEL_WIDTH, marginTop: -9 },
  // La primera hora del día queda al borde: su etiqueta no puede sobresalir hacia el día anterior.
  firstHourLabel: { marginTop: 1 },
  hourLine: { flex: 1, height: 1 },
  events: { position: 'absolute', top: 0, bottom: 0, left: LABEL_WIDTH, right: 0 },
  chart: { position: 'absolute', top: 0, bottom: 0, left: LABEL_WIDTH, right: 0 },
  // Cubre todo el día a la derecha de las horas, por debajo de las tarjetas.
  slots: { position: 'absolute', top: 0, bottom: 0, left: LABEL_WIDTH, right: 0 },
  edit: { width: EDIT_WIDTH, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  event: {
    position: 'absolute',
    borderRadius: Radius.control,
    paddingLeft: Spacing.two + 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // Mientras se arrastra: por encima del resto y con sombra.
  dragging: { zIndex: 10, ...({ boxShadow: '0 6px 18px rgba(0, 0, 0, 0.22)' } as object) },
  eventText: { flex: 1, justifyContent: 'center' },
  handle: {
    width: HANDLE_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    // Cursor de agarrar en la web: se ve que se puede mover.
    ...({ cursor: 'grab' } as object),
  },
  grip: { fontSize: 20, lineHeight: 22 },
  nowLine: {
    position: 'absolute',
    left: LABEL_WIDTH - 5,
    right: 0,
    height: 10,
    marginTop: -5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowDot: { width: 10, height: 10, borderRadius: 5 },
  nowRule: { flex: 1, height: 2 },
});
