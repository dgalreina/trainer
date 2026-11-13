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

import {
  COACH_BUBBLE_GAP,
  COACH_EDGE,
  COACH_ICON,
  useCoachIconBottom,
  useKeyboardInset,
} from '@/components/coach/coach-layout';
import { FadingScroll } from '@/components/fading-scroll';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, WebTabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCoach, type CoachMessage } from '@/lib/coach';

/** Preguntas para empezar, las que hará el usuario casi siempre. */
const SUGGESTIONS = [
  '¿En qué puedo mejorar?',
  'Hazme otro entreno',
  '¿Qué tal estoy comiendo?',
  '¿Qué me recomiendas para crecer más?',
];

/** Ancho máximo del chat y fracción de la pantalla que puede ocupar a lo alto (luego hace scroll por dentro). */
const BUBBLE_MAX_WIDTH = 380;
const BUBBLE_MAX_HEIGHT_FRACTION = 0.5;
/** Ancho máximo del saludo pequeño. */
const GREETING_MAX_WIDTH = 300;
/** Marca (solo web) para reconocer que un toque cae dentro del bocadillo o del icono y no cuenta como «fuera». */
export const COACH_MARK = { dataSet: { coach: '1' } } as object;
/** Un toque fuera cierra el bocadillo si el dedo se mueve menos de esto (px) y dura menos de esto (ms). */
const OUTSIDE_TAP_SLOP = 10;
const OUTSIDE_TAP_MS = 600;
/** Hueco entre el saludo pequeño y el icono (en la misma línea). */
const COACH_GREETING_GAP = 12;
/** Tamaño de la colita que apunta al icono. */
const TAIL = 14;

function Bubble({ message }: { message: Pick<CoachMessage, 'role' | 'text' | 'streaming'> }) {
  const theme = useTheme();
  const mine = message.role === 'user';
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowCoach]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: theme.skySoft, borderBottomRightRadius: Spacing.one }
            : { backgroundColor: theme.tealSoft, borderBottomLeftRadius: Spacing.one },
        ]}>
        <ThemedText>{message.text || (message.streaming ? '…' : '')}</ThemedText>
      </View>
    </View>
  );
}

/** La colita que sale por debajo del bocadillo y apunta al centro del icono. */
function Tail() {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tail,
        { right: COACH_ICON / 2 - TAIL / 2, backgroundColor: theme.background, borderColor: theme.skySoft },
      ]}
    />
  );
}

/**
 * El bocadillo del entrenador. Primero sale pequeño, pegado al icono y con su colita apuntándole, solo con el saludo
 * («Hola Diego, ¿en qué puedo ayudarte?») y sin más; tocar el bocadillo lo abre entero:
 * el saludo, unas preguntas de ejemplo y el cuadro de texto. Al escribir, crece hacia arriba y se convierte en la
 * conversación, hasta la mitad de la pantalla; a partir de ahí hace scroll por dentro. Los mensajes del entrenador van a
 * la izquierda y los tuyos a la derecha, como en WhatsApp. Todo lo de la IA es azulado y verdoso, no salmón. Tocar fuera,
 * Escape o el icono lo cierra; si sale el teclado, sube para quedar por encima de él.
 */
export function CoachChat() {
  const { open, setOpen, expanded, setExpanded, messages, greeting, busy, send, stop } = useCoach();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const iconBottom = useCoachIconBottom();
  const keyboard = useKeyboardInset(open && expanded);
  const [draft, setDraft] = useState('');
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

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

  // Con el chat grande abierto, el fondo se oscurece un poco para que el foco esté en el chat y el icono. Es solo visual
  // (no capta toques: se puede seguir haciendo scroll por detrás). Con el saludo pequeño no se oscurece.
  const dim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(dim, { toValue: open && expanded ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, expanded, dim]);

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

  function submit() {
    if (!draft.trim() || busy) return;
    send(draft);
    setDraft('');
  }

  // Encima del icono; con el teclado abierto, encima del teclado.
  const bottom = keyboard > 0 ? keyboard + COACH_BUBBLE_GAP : iconBottom + COACH_ICON + COACH_BUBBLE_GAP;
  const topLimit = insets.top + (Platform.OS === 'web' ? WebTabBarInset : Spacing.four);
  const maxHeight = Math.max(160, Math.min(height * BUBBLE_MAX_HEIGHT_FRACTION, height - bottom - topLimit));
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  // Crece desde el icono: la esquina de abajo a la derecha es el origen.
  const appearStyle = { opacity: appear, transform: [{ scale }], transformOrigin: 'right bottom' } as object;

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.dim, { opacity: dim }]} />

      {/* En nativo, un fondo táctil sin color: tocar fuera cierra el bocadillo. (En la web se detecta sin tapar la pantalla.) */}
      {Platform.OS !== 'web' ? (
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
            <ThemedText numberOfLines={2} style={styles.greetingText}>
              {greeting}
            </ThemedText>
            {/* La colita, a la derecha y a media altura, apuntando al icono. */}
            <View
              pointerEvents="none"
              style={[styles.sideTail, { backgroundColor: theme.background, borderColor: theme.skySoft }]}
            />
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View
          {...COACH_MARK}
          style={[
            styles.card,
            {
              bottom,
              right: COACH_EDGE,
              width: Math.min(BUBBLE_MAX_WIDTH, width - COACH_EDGE * 2),
              maxHeight,
              backgroundColor: theme.background,
              borderColor: theme.skySoft,
            },
            appearStyle,
          ]}>
          {/* Un ligero desvanecimiento arriba cuando la conversación se ha desplazado. */}
          <FadingScroll
            mask
            fadeBottom={false}
            fadeTop={24}
            scrollRef={scroller}
            containerStyle={styles.messagesBox}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
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
              <Bubble key={m.id} message={m} />
            ))}
          </FadingScroll>

          <View style={[styles.inputRow, { borderTopColor: theme.skySoft }]}>
            <TextInput
              accessibilityLabel="Escribe a tu entrenador"
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe tu pregunta…"
              placeholderTextColor={theme.textSecondary}
              autoComplete="off"
              multiline
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
                { backgroundColor: theme.skySoft, color: theme.text },
                // El aro de enfoque del navegador, azul y no salmón.
                { outlineColor: theme.sky } as object,
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? 'Parar' : 'Enviar'}
              disabled={!busy && !draft.trim()}
              onPress={busy ? stop : submit}
              style={[styles.send, { backgroundColor: theme.teal, opacity: !busy && !draft.trim() ? 0.4 : 1 }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {busy ? '■' : '↑'}
              </ThemedText>
            </Pressable>
          </View>

          {keyboard === 0 ? <Tail /> : null}
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 48 },
  // Por debajo del bocadillo (49) y del icono (50), por encima de todo lo demás.
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 47, backgroundColor: 'rgba(0, 0, 0, 0.28)' },
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
  messagesBox: { flex: 0, flexGrow: 0, flexShrink: 1, flexBasis: 'auto' },
  messages: { flexGrow: 0, flexShrink: 1 },
  messagesContent: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowCoach: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '88%', borderRadius: Radius.card, paddingVertical: Spacing.two + 2, paddingHorizontal: Spacing.three },
  suggestions: { gap: Spacing.two, alignItems: 'flex-start' },
  suggestion: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tail: {
    position: 'absolute',
    bottom: -TAIL / 2,
    width: TAIL,
    height: TAIL,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
});
