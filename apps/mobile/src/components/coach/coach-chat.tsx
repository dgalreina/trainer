import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { COACH_EDGE, COACH_ICON, useCoachIconBottom, useKeyboardInset, useViewportTop } from '@/components/coach/coach-layout';
import { CoachOrb } from '@/components/coach/coach-orb';
import { ProposalCard } from '@/components/coach/proposal-card';
import { RichText } from '@/components/coach/rich-text';
import { FadingScroll } from '@/components/fading-scroll';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCoach, type CoachMessage } from '@/lib/coach';

/** Preguntas para empezar, las que hará el usuario casi siempre. */
const SUGGESTIONS = [
  '¿En qué puedo mejorar?',
  'Hazme otro entreno',
  '¿Qué tal estoy comiendo?',
  '¿Qué me recomiendas para crecer más?',
];

/** Ancho máximo de la columna del chat a pantalla completa (en pantallas anchas queda centrada). */
const CHAT_MAX_WIDTH = 720;
/** Alto mínimo y máximo (unas 6 líneas) del cuadro de texto. */
const INPUT_MIN_HEIGHT = 36;
const INPUT_MAX_HEIGHT = 140;
/** Tamaño de la orbe de la cabecera. */
const HEADER_ORB = 48;
/** Ancho máximo del saludo pequeño. */
const GREETING_MAX_WIDTH = 300;
/** Marca (solo web) para reconocer que un toque cae dentro del bocadillo o del icono y no cuenta como «fuera». */
export const COACH_MARK = { dataSet: { coach: '1' } } as object;
/** Un toque fuera cierra el bocadillo si el dedo se mueve menos de esto (px) y dura menos de esto (ms). */
const OUTSIDE_TAP_SLOP = 10;
const OUTSIDE_TAP_MS = 600;
/** Hueco entre el saludo pequeño y el icono (en la misma línea). */
const COACH_GREETING_GAP = 12;
/** Tamaño de la colita del saludo que apunta al icono. */
const TAIL = 14;

/** La flecha de enviar: trazo grueso y redondeado, grande como la de Claude. */
function ArrowUpIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** El cuadrado de «parar» mientras el entrenador responde. */
function StopIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x={6.5} y={6.5} width={11} height={11} rx={2.5} fill={color} />
    </Svg>
  );
}

function Bubble({
  message,
  onRequestChanges,
}: {
  message: Pick<CoachMessage, 'role' | 'text' | 'streaming' | 'error'> & { id?: string; proposal?: CoachMessage['proposal'] };
  onRequestChanges?: () => void;
}) {
  const theme = useTheme();
  const mine = message.role === 'user';
  return (
    <>
    <View style={[styles.row, mine ? styles.rowMine : styles.rowCoach]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: theme.skySoft, borderBottomRightRadius: Spacing.one }
            : { backgroundColor: theme.tealSoft, borderBottomLeftRadius: Spacing.one },
        ]}>
        {mine ? (
          <ThemedText>{message.text}</ThemedText>
        ) : (
          // Las respuestas del entrenador llevan Markdown (negritas, listas): se pintan con formato.
          <RichText text={message.text || (message.streaming ? '…' : '')} themeColor={message.error ? 'textSecondary' : undefined} />
        )}
      </View>
    </View>
    {/* Si el entrenador propone un entrenamiento, debajo de su mensaje va la tarjeta para guardarlo o pedir cambios. */}
    {!mine && message.proposal && message.id ? (
      <View style={[styles.row, styles.rowCoach]}>
        <ProposalCard
          messageId={message.id}
          proposal={message.proposal}
          onRequestChanges={onRequestChanges ?? (() => {})}
        />
      </View>
    ) : null}
    </>
  );
}

/**
 * El chat del entrenador. Cuando habla él primero sale un saludo pequeño junto al icono (abajo a la derecha, con su
 * colita); tocarlo —o pulsar el icono— abre el chat a pantalla completa, como el de Claude: arriba la orbe en el centro
 * y una ✕ para cerrar, en medio la conversación (los mensajes del entrenador a la izquierda y los tuyos a la derecha) y
 * abajo el cuadro de texto, que crece con lo que escribes, con su botón de enviar. En pantallas anchas la columna se
 * centra. Todo lo de la IA es azulado y verdoso, no salmón. Escape o la ✕ lo cierran; con el teclado, sube con él.
 */
export function CoachChat() {
  const { open, setOpen, expanded, setExpanded, messages, greeting, nudge, busy, excited, send, stop } = useCoach();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const iconBottom = useCoachIconBottom();
  const keyboard = useKeyboardInset(open && expanded);
  const viewportTop = useViewportTop(open && expanded);
  const [draft, setDraft] = useState('');
  // Alto del texto escrito: el cuadro crece con él hasta INPUT_MAX_HEIGHT y luego hace scroll por dentro.
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  // La conversación ya está colocada en el último mensaje (hasta entonces se mantiene invisible, sin recorrido visible).
  const [positioned, setPositioned] = useState(false);
  useEffect(() => {
    if (!open || !expanded) setPositioned(false);
  }, [open, expanded]);

  // Aparece desde el icono: crece y se aclara (y se queda montado mientras se va, para poder animar la salida).
  const [mounted, setMounted] = useState(open);
  const appear = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(appear, {
      toValue: open ? 1 : 0,
      duration: open ? 200 : 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, appear]);

  // Escape lo cierra (web).
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Web: tocar fuera lo cierra, pero sin una capa que tape la pantalla: así se puede seguir haciendo scroll (también
  // el horizontal entre pestañas) con el bocadillo abierto. Cuenta como toque si el dedo apenas se mueve y es breve;
  // un gesto de scroll acaba en `pointercancel` y no cierra nada. El icono y el bocadillo llevan `data-coach`.
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    let start: { x: number; y: number; at: number; inside: boolean } | null = null;
    const insideCoach = (target: EventTarget | null) => Boolean((target as Element | null)?.closest?.('[data-coach]'));
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY, at: Date.now(), inside: insideCoach(e.target) };
    };
    const up = (e: PointerEvent) => {
      const began = start;
      start = null;
      if (!began || began.inside) return;
      const tap = Math.hypot(e.clientX - began.x, e.clientY - began.y) < OUTSIDE_TAP_SLOP && Date.now() - began.at < OUTSIDE_TAP_MS;
      if (tap) setOpen(false);
    };
    const cancel = () => {
      start = null;
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
    };
  }, [open, setOpen]);

  if (!mounted) return null;

  // «Pedir cambios» de una propuesta: el cuadro de texto queda listo para decir qué cambiar.
  function requestChanges() {
    setDraft((prev) => prev || 'Cámbiame ');
    inputRef.current?.focus();
  }

  function submit() {
    if (!draft.trim() || busy) return;
    send(draft);
    setDraft('');
  }

  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  // El saludo pequeño crece desde el icono: la esquina de abajo a la derecha es el origen.
  const appearStyle = { opacity: appear, transform: [{ scale }], transformOrigin: 'right bottom' } as object;

  return (
    <>
      {/* En nativo, un fondo táctil sin color: tocar fuera cierra el bocadillo. (En la web se detecta sin tapar la pantalla.) */}
      {Platform.OS !== 'web' && !expanded ? (
        <Pressable accessibilityLabel="Cerrar el chat" style={styles.backdrop} onPress={() => setOpen(false)} />
      ) : null}

      {!expanded ? (
        // El saludo pequeño: en la misma línea que el icono, a su izquierda, con la colita hacia él. Lo vistoso es el
        // icono y el bocadillo; tocar el bocadillo abre el chat entero (sin flecha).
        <Animated.View
          pointerEvents="box-none"
          {...COACH_MARK}
          style={[
            styles.greetingRow,
            { bottom: iconBottom, right: COACH_EDGE + COACH_ICON + COACH_GREETING_GAP },
            appearStyle,
            { transformOrigin: 'right center' } as object,
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir el chat"
            onPress={() => setExpanded(true)}
            style={[
              styles.card,
              styles.greeting,
              { maxWidth: width - COACH_EDGE * 2 - COACH_ICON - COACH_GREETING_GAP, backgroundColor: theme.background, borderColor: theme.skySoft },
            ]}>
            <ThemedText numberOfLines={nudge ? 3 : 2} style={styles.greetingText}>
              {nudge ?? greeting}
            </ThemedText>
            {/* La colita, a la derecha y a media altura, apuntando al icono. */}
            <View
              pointerEvents="none"
              style={[styles.sideTail, { backgroundColor: theme.background, borderColor: theme.skySoft }]}
            />
          </Pressable>
        </Animated.View>
      ) : (
        // Pantalla completa. Con el teclado abierto se queda encima de él.
        <Animated.View
          {...COACH_MARK}
          style={[
            styles.full,
            {
              backgroundColor: theme.background,
              top: viewportTop,
              bottom: keyboard,
              paddingBottom: keyboard > 0 ? Spacing.two : insets.bottom,
              opacity: appear,
            },
          ]}>
          <View style={styles.column}>
            {/* La cabecera flota sobre la conversación: los mensajes se ven hasta el borde de arriba de la pantalla. */}
            <View pointerEvents="box-none" style={[styles.header, { top: insets.top }]}>
              {/* La orbe es el botón de cerrar: lleva una X dentro para que se entienda. */}
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar el chat" onPress={() => setOpen(false)} hitSlop={8}>
                <CoachOrb size={HEADER_ORB} excited={excited || busy} />
                <View pointerEvents="none" style={styles.orbX}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M6 6l12 12M18 6L6 18" stroke={theme.aiText} strokeOpacity={0.7} strokeWidth={2.2} strokeLinecap="round" />
                  </Svg>
                </View>
              </Pressable>
            </View>

            {/* Sin difuminado ni corte arriba. Al abrir, la conversación sale ya en el último mensaje (sin recorrerla); después, los nuevos bajan con animación. */}
            <FadingScroll
              mask
              fadeBottom={false}
              fadeTop={0}
              scrollRef={scroller}
              containerStyle={[styles.messagesBox, { opacity: positioned ? 1 : 0 }]}
              style={styles.messages}
              contentContainerStyle={[styles.messagesContent, { paddingTop: insets.top + HEADER_ORB + Spacing.three * 2 }]}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => {
                scroller.current?.scrollToEnd({ animated: positioned });
                if (!positioned) requestAnimationFrame(() => setPositioned(true));
              }}>
              <Bubble message={{ role: 'coach', text: greeting }} />
              {messages.length === 0 ? (
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((text) => (
                    <Pressable
                      key={text}
                      accessibilityRole="button"
                      onPress={() => send(text)}
                      style={[styles.suggestion, { borderColor: theme.sky, backgroundColor: theme.background }]}>
                      <ThemedText type="small" style={{ color: theme.aiText }}>
                        {text}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {messages.map((m) => (
                <Bubble key={m.id} message={m} onRequestChanges={requestChanges} />
              ))}
            </FadingScroll>

            {/* El cuadro de texto, pegado abajo: crece con lo que escribes y lleva dentro el botón de enviar. */}
            <View style={[styles.inputBox, { backgroundColor: theme.skySoft }]}>
              <TextInput
                ref={inputRef}
                accessibilityLabel="Escribe a tu entrenador"
                value={draft}
                onChangeText={setDraft}
                placeholder="Escribe tu pregunta…"
                placeholderTextColor={theme.textSecondary}
                autoComplete="off"
                multiline
                onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
                onKeyPress={(e) => {
                  // En la web, Enter envía y Mayús+Enter hace salto de línea.
                  const native = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                  if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                style={[
                  styles.input,
                  { color: theme.text, height: Math.min(INPUT_MAX_HEIGHT, Math.max(INPUT_MIN_HEIGHT, inputHeight)) },
                  { outlineStyle: 'none' } as object,
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={busy ? 'Parar' : 'Enviar'}
                disabled={!busy && !draft.trim()}
                onPress={busy ? stop : submit}
                style={[styles.send, { backgroundColor: theme.teal, opacity: !busy && !draft.trim() ? 0.4 : 1 }]}>
                {busy ? <StopIcon color={theme.onPrimary} /> : <ArrowUpIcon color={theme.onPrimary} />}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 48 },
  full: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 49 },
  // La columna del chat: ocupa todo el ancho y, en pantallas anchas, se centra.
  column: { flex: 1, width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },
  header: { position: 'absolute', left: 0, right: 0, zIndex: 2, height: HEADER_ORB + Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: Spacing.three },
  orbX: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    zIndex: 49,
    borderRadius: Radius.card,
    borderWidth: 1,
    ...({ boxShadow: '0 8px 28px rgba(0, 0, 0, 0.18)' } as object),
  },
  // Fila de la altura del icono, para que el saludo quede centrado con él.
  greetingRow: { position: 'absolute', zIndex: 49, height: COACH_ICON, justifyContent: 'center', alignItems: 'flex-end' },
  greeting: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  greetingText: { flexShrink: 1, fontSize: 14, lineHeight: 20 },
  sideTail: {
    position: 'absolute',
    right: -TAIL / 2,
    top: '50%',
    marginTop: -TAIL / 2,
    width: TAIL,
    height: TAIL,
    borderTopWidth: 1,
    borderRightWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  // El contenedor se ajusta al contenido y solo encoge si no cabe (el bocadillo tiene un alto máximo).
  messagesBox: { flex: 1 },
  messages: { flex: 1 },
  messagesContent: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowCoach: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '88%', borderRadius: Radius.card, paddingVertical: Spacing.two + 2, paddingHorizontal: Spacing.three },
  suggestions: { gap: Spacing.two, alignItems: 'flex-start' },
  suggestion: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.four,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 26,
  },
  input: { flex: 1, paddingVertical: 0, fontSize: 16, lineHeight: 22 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
