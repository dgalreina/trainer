import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type ScrollViewInstance,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { DayEnergy } from '@trainer/shared';

import { DayEnergyChart } from '@/components/day-energy-chart';
import { FadingScroll } from '@/components/fading-scroll';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentDay, dayStart as dayStartOf, formatTime } from '@/lib/dates';
import type { DayEvent } from '@/lib/week-events';

const HOUR_HEIGHT = 56;
const LABEL_WIDTH = 48;
// Alto mínimo de cada tipo: un entreno lleva dos líneas de texto; una pesada, una.
const MIN_HEIGHT = { workout: 52, weight: 34, meal: 52, plan: 52 } as const;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
/** Al soltar un evento arrastrado, la hora se ajusta a múltiplos de estos minutos. */
const SNAP_MINUTES = 5;
const DAY_MINUTES = 24 * 60;
const HANDLE_WIDTH = 30;
const EDIT_WIDTH = 34;
/** Las tarjetas dejan ver las gráficas de detrás: opacidad de su fondo. */
const CARD_OPACITY = 0.82;

/** Un color #RRGGBB con transparencia. */
const withAlpha = (hex: string, alpha: number) =>
  hex.length === 7 ? hex + Math.round(alpha * 255).toString(16).padStart(2, '0') : hex;
/** Al tocar un hueco del día para añadir algo, la hora se redondea hacia abajo a múltiplos de esto. */
const SLOT_MINUTES = 15;

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

/**
 * Un día con las horas de arriba abajo y lo que pasó en cada una. Los eventos se pueden arrastrar;
 * tocar un hueco vacío propone añadir algo a esa hora.
 */
export function DayTimeline({
  day,
  events,
  onPressEvent,
  onEditEvent,
  onMoveEvent,
  onPressSlot,
  energy,
  startMinutes = 0,
}: {
  day: string;
  events: DayEvent[];
  /** A qué hora empieza el día del usuario, en minutos desde las 00:00: el día va de ahí a la misma hora del siguiente. */
  startMinutes?: number;
  /** Gasto, consumo y balance del día para las gráficas de fondo; sin él no se dibujan. */
  energy?: DayEnergy | null;
  onPressEvent?: (event: DayEvent) => void;
  /** Se llama al pulsar el lápiz de una comida. */
  onEditEvent?: (event: DayEvent) => void;
  /** Se llama al soltar un evento arrastrado, con su nueva hora de inicio. */
  onMoveEvent?: (event: DayEvent, newStart: Date) => void;
  /** Se llama al tocar un hueco del día, con la hora tocada. */
  onPressSlot?: (time: Date) => void;
}) {
  const theme = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const today = currentDay(startMinutes);
  const isToday = day === today;
  const dayStart = dayStartOf(day, startMinutes).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [areaWidth, setAreaWidth] = useState(0);

  // La línea de "ahora" avanza cada minuto, solo en el día de hoy.
  useEffect(() => {
    if (!isToday) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, [isToday]);

  const { placed, columns } = placeEvents(events);

  // Al abrir un día se muestra la zona que importa: lo primero que pasó, la hora actual o, si no hay nada,
  // las 7 (con el día normal) o el principio del día (si empieza a otra hora). En horas desde su inicio.
  const firstEvent = events[0];
  const focusHour = firstEvent
    ? Math.floor((firstEvent.start.getTime() - dayStart) / HOUR_MS) - 1
    : isToday
      ? Math.floor((Date.now() - dayStart) / HOUR_MS) - 2
      : startMinutes === 0
        ? 7
        : 0;
  useEffect(() => {
    const timer = setTimeout(
      () => scroll.current?.scrollTo({ y: Math.max(0, focusHour) * HOUR_HEIGHT, animated: false }),
      50,
    );
    return () => clearTimeout(timer);
  }, [day, focusHour]);

  const nowTop = ((now - dayStart) / HOUR_MS) * HOUR_HEIGHT;
  // Lo que aún no ha pasado se dibuja tenue: hoy, desde ahora; un día futuro, entero.
  const dimFrom = day > today ? 0 : isToday ? nowTop : 24 * HOUR_HEIGHT;

  // Las rayas son las horas en punto del reloj, desde la primera que cae dentro del día.
  const hourMarks = useMemo(() => {
    const marks: { top: number; label: string }[] = [];
    for (let m = Math.ceil(startMinutes / 60) * 60; m < startMinutes + DAY_MINUTES; m += 60) {
      marks.push({ top: ((m - startMinutes) / 60) * HOUR_HEIGHT, label: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:00` });
    }
    return marks;
  }, [startMinutes]);

  return (
    <View style={styles.wrapper}>
      {events.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Nada registrado este día. Toca una hora para añadir algo.
        </ThemedText>
      )}
      {/* Difuminado arriba y abajo cuando hay más por ver; por máscara, para que valga sobre las gráficas y las ondas. */}
      <FadingScroll mask scrollRef={scroll} style={styles.scroll} nestedScrollEnabled>
        <View style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Gráficas del día, por debajo de todo lo demás. */}
          <View pointerEvents="none" style={styles.chart}>
            {energy && areaWidth > 0 ? (
              <DayEnergyChart energy={energy} width={areaWidth} height={24 * HOUR_HEIGHT} dimFrom={dimFrom} />
            ) : null}
          </View>

          {hourMarks.map((mark) => (
            <View key={mark.top} pointerEvents="none" style={[styles.hourRow, { top: mark.top }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.hourLabel}>
                {mark.label}
              </ThemedText>
              <View style={[styles.hourLine, { backgroundColor: theme.backgroundSelected }]} />
            </View>
          ))}

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

          {isToday && nowTop >= 0 && nowTop <= 24 * HOUR_HEIGHT && (
            <View pointerEvents="none" style={[styles.nowLine, { top: nowTop }]}>
              <View style={[styles.nowDot, { backgroundColor: theme.primary }]} />
              <View style={[styles.nowRule, { backgroundColor: theme.primary }]} />
            </View>
          )}
        </View>
      </FadingScroll>
    </View>
  );
}

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

  const top = ((event.start.getTime() - dayStart) / HOUR_MS) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
  const height = Math.max(
    MIN_HEIGHT[event.kind],
    ((event.end.getTime() - event.start.getTime()) / HOUR_MS) * HOUR_HEIGHT - 2,
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
  // Ocupa el hueco que deja la pantalla: las horas hacen scroll dentro de él.
  wrapper: { flex: 1, gap: Spacing.two },
  empty: { textAlign: 'center' },
  scroll: { flex: 1 },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
    flexDirection: 'row',
  },
  hourLabel: { width: LABEL_WIDTH, marginTop: -9 },
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
