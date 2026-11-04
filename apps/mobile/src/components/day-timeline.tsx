import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { LinkButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime, startOfDay, todayISO } from '@/lib/dates';
import type { DayEvent } from '@/lib/week-events';

const HOUR_HEIGHT = 56;
const LABEL_WIDTH = 48;
// Alto mínimo de cada tipo: un entreno lleva dos líneas de texto; una pesada, una.
const MIN_HEIGHT = { workout: 52, weight: 34, meal: 52 } as const;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
/** Al soltar un evento arrastrado, la hora se ajusta a múltiplos de estos minutos. */
const SNAP_MINUTES = 5;
const DAY_MINUTES = 24 * 60;
const HANDLE_WIDTH = 30;

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

/**
 * Un día con las horas de arriba abajo y lo que pasó en cada una. Los eventos se pueden arrastrar.
 * No tiene scroll propio: crece con el día y es la pantalla la que hace scroll, título incluido.
 * Empieza donde importa (lo primero que pasó, la hora actual o las 7) y las horas anteriores se
 * abren con un botón.
 */
export function DayTimeline({
  day,
  events,
  onPressEvent,
  onMoveEvent,
}: {
  day: string;
  events: DayEvent[];
  onPressEvent?: (event: DayEvent) => void;
  /** Se llama al soltar un evento arrastrado, con su nueva hora de inicio. */
  onMoveEvent?: (event: DayEvent, newStart: Date) => void;
}) {
  const theme = useTheme();
  const isToday = day === todayISO();
  const dayStart = startOfDay(day).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [showAll, setShowAll] = useState(false);

  // La línea de "ahora" avanza cada minuto, solo en el día de hoy.
  useEffect(() => {
    if (!isToday) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, [isToday]);

  const { placed, columns } = placeEvents(events);

  const firstEvent = events[0];
  const focusHour = firstEvent
    ? firstEvent.start.getHours() - 1
    : isToday
      ? new Date().getHours() - 2
      : 7;
  // Cada día empieza recogido: las horas anteriores a la zona que importa se abren con el botón.
  useEffect(() => setShowAll(false), [day]);
  const startHour = showAll ? 0 : Math.min(Math.max(0, focusHour), 23);
  const offset = startHour * HOUR_HEIGHT;
  const hours = HOURS.slice(startHour);

  const nowTop = ((now - dayStart) / HOUR_MS) * HOUR_HEIGHT - offset;

  return (
    <View style={styles.wrapper}>
      {events.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          Nada registrado este día.
        </ThemedText>
      )}
      {startHour > 0 && (
        <LinkButton centered title="Ver horas anteriores" onPress={() => setShowAll(true)} />
      )}
      <View style={{ height: (24 - startHour) * HOUR_HEIGHT }}>
        {hours.map((hour) => (
          <View key={hour} style={[styles.hourRow, { top: (hour - startHour) * HOUR_HEIGHT }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hourLabel}>
              {String(hour).padStart(2, '0')}:00
            </ThemedText>
            <View style={[styles.hourLine, { backgroundColor: theme.backgroundSelected }]} />
          </View>
        ))}

        {/* Zona de eventos, a la derecha de las horas. */}
        <View style={styles.events}>
          {placed.map(({ event, column }) => (
            <EventCard
              key={event.id}
              event={event}
              dayStart={dayStart}
              offset={offset}
              column={column}
              columns={columns}
              onPress={onPressEvent}
              onMove={onMoveEvent}
            />
          ))}
        </View>

        {isToday && nowTop >= 0 && nowTop <= (24 - startHour) * HOUR_HEIGHT && (
          <View pointerEvents="none" style={[styles.nowLine, { top: nowTop }]}>
            <View style={[styles.nowDot, { backgroundColor: theme.primary }]} />
            <View style={[styles.nowRule, { backgroundColor: theme.primary }]} />
          </View>
        )}
      </View>
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
  offset,
  column,
  columns,
  onPress,
  onMove,
}: {
  event: DayEvent;
  dayStart: number;
  /** Píxeles de las horas recogidas por encima de la primera que se ve. */
  offset: number;
  column: number;
  columns: number;
  onPress?: (event: DayEvent) => void;
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

  const top = ((event.start.getTime() - dayStart) / HOUR_MS) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT - offset;
  const height = Math.max(
    MIN_HEIGHT[event.kind],
    ((event.end.getTime() - event.start.getTime()) / HOUR_MS) * HOUR_HEIGHT - 2,
  );
  // Salmón para lo que entra (comidas) y azul cielo para lo que se gasta (entrenos).
  const background =
    event.kind === 'meal'
      ? theme.primarySoft
      : event.kind === 'workout'
        ? theme.skySoft
        : theme.backgroundElement;
  const canMove = Boolean(onMove);

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
          backgroundColor: background,
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
  wrapper: { gap: Spacing.two },
  empty: { textAlign: 'center' },
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
