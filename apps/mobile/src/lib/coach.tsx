import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/lib/auth';
import { streamCoachReply } from '@/lib/coach-stub';
import { useMe } from '@/lib/me';

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  /** El texto de la respuesta aún está llegando. */
  streaming?: boolean;
}

interface CoachValue {
  /** El chat está abierto. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Con el bocadillo abierto: false = solo el saludo pequeño; true = el chat completo. */
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  /** La conversación (sin el saludo, que se calcula con el nombre del usuario). */
  messages: CoachMessage[];
  /** El saludo del entrenador: «Hola Diego, ¿en qué puedo ayudarte?». */
  greeting: string;
  /** Hay una respuesta en curso. */
  busy: boolean;
  /** El icono está «excitado»: se acaba de pulsar (unos segundos) o hay una respuesta en curso. */
  excited: boolean;
  send: (text: string) => void;
  /** Corta la respuesta en curso. */
  stop: () => void;
}

const CoachContext = createContext<CoachValue | null>(null);

/** Cuánto tiempo se queda excitado el icono tras pulsarlo (ms). */
const POKE_MS = 3000;

let nextId = 1;
const newId = () => `m${nextId++}`;

/**
 * El entrenador de IA: el chat (abierto o cerrado, con su conversación) y el hueco que pide la pantalla actual. Vive
 * en el layout raíz, así la conversación sigue al cambiar de pantalla. Por ahora responde en modo de prueba.
 */
export function CoachProvider({ children }: { children: ReactNode }) {
  const { profile } = useMe();
  const [open, setOpenState] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const messagesCount = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const [poked, setPoked] = useState(false);
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pokeTimer.current) clearTimeout(pokeTimer.current);
  }, []);

  // Al cerrar la sesión no queda nada de la conversación (otra persona podría entrar después en este dispositivo).
  const { status } = useAuth();
  useEffect(() => {
    if (status === 'signedIn') return;
    abort.current?.abort();
    abort.current = null;
    setMessages([]);
    setOpenState(false);
    setExpanded(false);
    setBusy(false);
  }, [status]);

  useEffect(() => {
    messagesCount.current = messages.length;
  }, [messages.length]);

  const firstName = profile.name?.trim().split(/\s+/)[0] ?? null;
  const greeting = firstName ? `Hola ${firstName}, ¿en qué puedo ayudarte?` : 'Hola, ¿en qué puedo ayudarte?';

  const stop = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
  }, []);

  const setOpen = useCallback(
    (value: boolean) => {
      // Cerrar el chat corta lo que se esté escribiendo (con la IA real, también cancela la llamada).
      if (!value) stop();
      // Al abrirlo, el icono se excita unos segundos y luego se calma solo.
      if (value) {
        setPoked(true);
        if (pokeTimer.current) clearTimeout(pokeTimer.current);
        pokeTimer.current = setTimeout(() => setPoked(false), POKE_MS);
      }
      // Se abre con el saludo pequeño; si ya hay conversación, directamente el chat entero.
      setExpanded(value && messagesCount.current > 0);
      setOpenState(value);
    },
    [stop],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || abort.current) return;
      const reply: CoachMessage = { id: newId(), role: 'coach', text: '', streaming: true };
      setMessages((prev) => [...prev, { id: newId(), role: 'user', text }, reply]);
      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;
      void (async () => {
        try {
          for await (const chunk of streamCoachReply(text, controller.signal)) {
            setMessages((prev) => prev.map((m) => (m.id === reply.id ? { ...m, text: m.text + chunk } : m)));
          }
        } finally {
          setMessages((prev) => prev.map((m) => (m.id === reply.id ? { ...m, streaming: false } : m)));
          if (abort.current === controller) abort.current = null;
          setBusy(false);
        }
      })();
    },
    [],
  );

  const value = useMemo<CoachValue>(
    () => ({ open, setOpen, expanded, setExpanded, messages, greeting, busy, excited: busy || poked, send, stop }),
    [open, setOpen, expanded, messages, greeting, busy, poked, send, stop],
  );
  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach(): CoachValue {
  const value = useContext(CoachContext);
  if (!value) throw new Error('useCoach debe usarse dentro de CoachProvider');
  return value;
}
