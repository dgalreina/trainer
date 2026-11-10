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
  Platform,
  Pressable,
  StyleSheet,
  Vibration,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { DayEnergy } from '@trainer/shared';

import { DayEnergyChart } from '@/components/day-energy-chart';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatLongDay, formatTime, parseISO, startOfDay } from '@/lib/dates';
import type { DayEvent } from '@/lib/week-events';

const HOUR_HEIGHT = 56;
const LABEL_WIDTH = 48;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * HOUR_MS;
/** Al soltar un evento arrastrado, la hora se ajusta a múltiplos de estos minutos. */
const SNAP_MINUTES = 5;
const DAY_MINUTES = 24 * 60;
/** Diámetro de los círculos de comidas, pesadas y entrenos, y separación entre carriles. */
const CIRCLE = 64;
const LANE_GAP = 6;
/** Último carril que cabe en un móvil estrecho (zona de eventos ≈ 340 px). */
const MAX_LANE = 3;
/** Cuánto hay que mantener pulsado un círculo para poder arrastrarlo. */
const LONG_PRESS_MS = 350;
/** Lo que puede moverse el dedo (px) y seguir contando como pulsación. */
const TAP_SLOP = 10;
/** Alto de la tarjeta «Día X» al empezar cada día y de cada marca que la sigue. */
const DAY_CARD_HEIGHT = 28;
const MARK_HEIGHT = 22;
/** Los círculos dejan ver algo de la gráfica de detrás: opacidad de su fondo. */
const CIRCLE_OPACITY = 0.94;
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

/** Un evento que se está arrastrando y la hora provisional a la que quedaría: las gráficas la siguen en vivo. */
export interface DragPreview {
  id: string;
  start: Date;
}

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
  /** Carril horizontal: 0 pegado al margen izquierdo; los círculos que se pisan en vertical van al siguiente. */
  lane: number;
}

/** Altura (px) del borde de arriba de un círculo: centrado en la hora del evento, sin salirse de su día. */
function circleTop(startMs: number, dayStart: number): number {
  const centre = ((startMs - dayStart) / HOUR_MS) * HOUR_HEIGHT;
  return Math.min(Math.max(centre - CIRCLE / 2, 0), DAY_HEIGHT - CIRCLE);
}

/**
 * Reparte en carriles los círculos que se pisan en vertical, para que no se tapen entre sí: apoyados en el
 * margen izquierdo, el primero pegado a él y los siguientes, uno tras otro, hacia la derecha.
 */
function placeCircles(events: DayEvent[], dayStart: number): Placed[] {
  const laneEnds: number[] = [];
  return events.map((event): Placed => {
    const top = circleTop(event.start.getTime(), dayStart);
    let lane = laneEnds.findIndex((end) => end <= top);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = top + CIRCLE + 2;
    // Más allá del último carril que cabe en pantalla, los círculos se apilan en él (mejor pisados que fuera).
    return { event, lane: Math.min(lane, MAX_LANE) };
  });
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

/**
 * Difuminado de arriba: lo que pasa por detrás de la barra de pestañas se desvanece, y justo debajo ya se ve
 * entero. Es una máscara CSS sobre la lista, así que vale sobre las gráficas y lo que haya detrás.
 */
function topFade(inset: number): object {
  const image = `linear-gradient(to bottom, transparent 0, transparent ${Math.round(inset * 0.55)}px, #000 ${inset + 14}px)`;
  return { maskImage: image, WebkitMaskImage: image };
}

/** Lo que se puede pedir a la lista desde fuera. */
export interface DayListHandle {
  /** Lleva el scroll al día indicado, a la hora que interesa (la de ahora si es hoy; las 7 si no). */
  scrollToDay: (day: string, animated?: boolean) => void;
}

interface Handlers {
  /** Se llama al tocar un círculo (comida, pesada o entreno). */
  onPressEvent?: (event: DayEvent) => void;
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
    modelOf: (day: string, preview?: DragPreview) => DayModel;
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

  const { onPressEvent, onMoveEvent, onPressSlot } = handlers;
  // El evento que se arrastra ahora mismo (solo uno a la vez): su día recalcula las gráficas con su hora provisional.
  const [drag, setDrag] = useState<(DragPreview & { day: string }) | null>(null);
  const onDragEvent = useCallback((day: string, preview: DragPreview | null) => {
    setDrag((prev) => (preview ? { ...preview, day } : prev === null ? prev : null));
  }, []);
  const renderItem = useCallback(
    ({ item }: { item: number }) => {
      const day = dayOfIndex(item);
      return (
      <DayColumn
        day={day}
        today={today}
        modelOf={modelOf}
        preview={drag && drag.day === day ? drag : null}
        onDragEvent={onDragEvent}
        onPressEvent={onPressEvent}
        onMoveEvent={onMoveEvent}
        onPressSlot={onPressSlot}
      />
      );
    },
    [dayOfIndex, today, modelOf, drag, onDragEvent, onPressEvent, onMoveEvent, onPressSlot],
  );

  return (
    <View style={[styles.list, Platform.OS === 'web' ? topFade(topInset) : null]}>
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
    </View>
  );
});

/** Un día: sus 24 horas de arriba abajo con lo que pasó en cada una. Los eventos se pueden arrastrar; tocar un hueco propone añadir algo. */
const DayColumn = memo(function DayColumn({
  day,
  today,
  modelOf,
  preview,
  onDragEvent,
  onPressEvent,
  onMoveEvent,
  onPressSlot,
}: {
  day: string;
  today: string;
  modelOf: (day: string, preview?: DragPreview) => DayModel;
  /** El evento de este día que se está arrastrando, con su hora provisional (para las gráficas). */
  preview: DragPreview | null;
  onDragEvent: (day: string, preview: DragPreview | null) => void;
} & Handlers) {
  const theme = useTheme();
  const { events, energy, marks, loaded } = useMemo(() => modelOf(day, preview ?? undefined), [modelOf, day, preview]);
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

  const placed = useMemo(() => placeCircles(events, dayStart), [events, dayStart]);

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

        {/* Zona de eventos, a la derecha de las horas. Solo los círculos capturan el toque. */}
        <View
          pointerEvents="box-none"
          style={styles.events}
          onLayout={(e) => setAreaWidth(e.nativeEvent.layout.width)}>
          {placed.map(({ event, lane }) => (
            <EventCircle
              key={event.id}
              event={event}
              dayStart={dayStart}
              lane={lane}
              onPress={onPressEvent}
              onMove={onMoveEvent}
              onDrag={(preview) => onDragEvent(day, preview)}
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

/** Para que una pulsación larga no seleccione texto ni abra el menú del navegador (solo web). */
const NO_SELECT = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
} as object;

/**
 * Una comida, una pesada o un entreno, como un círculo pequeño: el nombre y debajo lo que cuenta (las
 * calorías, los kilos, las series). Tocarlo lo abre. Pulsándolo un rato (con una pequeña vibración donde el
 * dispositivo la permite) se agarra y se arrastra de arriba abajo; si el dedo se mueve antes, es un scroll
 * normal. En la web, una vez agarrado se impide que el navegador haga scroll con ese mismo movimiento.
 */
function EventCircle({
  event,
  dayStart,
  lane,
  onPress,
  onMove,
  onDrag,
}: {
  event: DayEvent;
  dayStart: number;
  lane: number;
  onPress?: (event: DayEvent) => void;
  onMove?: (event: DayEvent, newStart: Date) => void;
  /** Mientras se arrastra, la hora provisional (con el ajuste a 5 min); `null` al soltar. */
  onDrag?: (preview: DragPreview | null) => void;
}) {
  const theme = useTheme();
  const node = useRef<unknown>(null);
  const [dragDy, setDragDy] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** La pulsación larga ya se ha cumplido: a partir de ahí, el movimiento arrastra. */
  const armed = useRef(false);

  // Los gestos se crean una sola vez; leen siempre los datos más recientes desde aquí.
  const latest = useRef({ event, dayStart, onPress, onMove });
  useEffect(() => {
    latest.current = { event, dayStart, onPress, onMove };
  });

  const clearHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, []);
  useEffect(() => clearHold, [clearHold]);

  // Web: una vez agarrado, el navegador no debe empezar a hacer scroll con el movimiento del dedo. Hay que
  // cancelarlo en el propio evento táctil, y para eso el escuchador no puede ser pasivo.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = node.current as unknown as HTMLElement | null;
    if (!element) return;
    const block = (e: TouchEvent) => {
      if (armed.current && e.cancelable) e.preventDefault();
    };
    element.addEventListener('touchmove', block, { passive: false });
    // Al soltar, se evita el clic «fantasma» que el navegador genera después: caería sobre la ventana que
    // se acaba de abrir con el toque y la cerraría al instante.
    const swallowClick = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    element.addEventListener('touchend', swallowClick, { passive: false });
    return () => {
      element.removeEventListener('touchmove', block);
      element.removeEventListener('touchend', swallowClick);
    };
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => armed.current,
        // Ya agarrado, nadie (ni el scroll ni el paginador de pestañas) se lo quita.
        onPanResponderTerminationRequest: () => !armed.current,
        onPanResponderGrant: () => {
          armed.current = false;
          clearHold();
          holdTimer.current = setTimeout(() => {
            armed.current = true;
            Vibration.vibrate(15);
            setDragDy(0);
          }, LONG_PRESS_MS);
        },
        onPanResponderMove: (_e, g) => {
          if (armed.current) setDragDy(g.dy);
          // Si el dedo se mueve antes de tiempo, no es una pulsación larga: se deja el scroll en paz.
          else if (Math.hypot(g.dx, g.dy) > TAP_SLOP) clearHold();
        },
        onPanResponderRelease: (_e, g) => {
          clearHold();
          const { event: current, dayStart: start, onPress: press, onMove: move } = latest.current;
          if (armed.current) {
            const minutes = dragMinutes(g.dy, current, start);
            if (minutes !== 0) move?.(current, new Date(current.start.getTime() + minutes * MINUTE_MS));
          } else if (Math.hypot(g.dx, g.dy) <= TAP_SLOP) {
            press?.(current);
          }
          armed.current = false;
          setDragDy(null);
        },
        onPanResponderTerminate: () => {
          clearHold();
          armed.current = false;
          setDragDy(null);
        },
      }),
    [clearHold],
  );

  const dragging = dragDy !== null;
  const minutes = dragging ? dragMinutes(dragDy, event, dayStart) : 0;
  const start = new Date(event.start.getTime() + minutes * MINUTE_MS);

  // Las gráficas siguen al círculo: se avisa solo cuando cambia la hora ajustada, no a cada píxel.
  const wasDragging = useRef(false);
  const onDragRef = useRef(onDrag);
  useEffect(() => {
    onDragRef.current = onDrag;
  });
  useEffect(() => {
    if (!dragging && !wasDragging.current) return;
    wasDragging.current = dragging;
    onDragRef.current?.(dragging ? { id: event.id, start: new Date(event.start.getTime() + minutes * MINUTE_MS) } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, minutes]);
  const top = Math.min(
    Math.max(circleTop(event.start.getTime(), dayStart) + (minutes / 60) * HOUR_HEIGHT, 0),
    DAY_HEIGHT - CIRCLE,
  );

  // Salmón para lo que entra (comidas), azul cielo para lo que se gasta (entrenos) y neutro para el peso.
  const tone = event.kind === 'workout' ? theme.sky : event.kind === 'weight' ? theme.textSecondary : theme.primary;
  const fill =
    event.kind === 'workout' ? theme.skySoft : event.kind === 'weight' ? theme.backgroundElement : theme.primarySoft;

  return (
    <View
      ref={node as never}
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={event.subtitle ? `${event.title}, ${event.subtitle}` : event.title}
      style={[
        styles.circle,
        { top, left: lane * (CIRCLE + LANE_GAP) + 2, backgroundColor: withAlpha(fill, CIRCLE_OPACITY), borderColor: tone },
        dragging && styles.dragging,
        NO_SELECT,
      ]}>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.circleTitle}>
        {event.title}
      </ThemedText>
      {event.subtitle ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.circleSub}>
          {event.subtitle}
        </ThemedText>
      ) : null}
      {/* Mientras se arrastra, la hora a la que quedaría. */}
      {dragging ? (
        <View pointerEvents="none" style={[styles.timeTip, { backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {formatTime(start)}
          </ThemedText>
        </View>
      ) : null}
    </View>
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
  // Un círculo: pequeño, con el nombre arriba y debajo lo que cuenta. Solo él capta el toque.
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  circleTitle: { fontSize: 11, lineHeight: 14, textAlign: 'center', maxWidth: CIRCLE - 8 },
  circleSub: { fontSize: 10, lineHeight: 13, textAlign: 'center', maxWidth: CIRCLE - 8 },
  // La hora a la que quedaría, justo encima del círculo mientras se arrastra.
  timeTip: {
    position: 'absolute',
    top: -26,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  // Mientras se arrastra: por encima del resto, un poco más grande y con sombra.
  dragging: {
    zIndex: 10,
    transform: [{ scale: 1.1 }],
    ...({ boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)' } as object),
  },
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
