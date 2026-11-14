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

import type { CoachReply, CoachStoredMessage, CoachUsage } from '@trainer/shared';

import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMe } from '@/lib/me';

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  /** La respuesta aún está en camino. */
  streaming?: boolean;
  /** Un aviso (sin conexión, tope del mes...) en vez de una respuesta: no se manda a la IA como parte de la conversación. */
  error?: boolean;
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
  /** Borra toda la conversación (también en el servidor). */
  clearConversation: () => Promise<void>;
  /** Lo que ha gastado de IA este mes (null hasta que se pide). */
  usage: CoachUsage | null;
  refreshUsage: () => Promise<void>;
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
  const [usage, setUsage] = useState<CoachUsage | null>(null);
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
    setUsage(null);
    setOpenState(false);
    setExpanded(false);
    setBusy(false);
  }, [status]);

  useEffect(() => {
    messagesCount.current = messages.length;
  }, [messages.length]);

  // La conversación vive en el servidor: al entrar se recupera, así sigue ahí al reabrir la app o desde otro dispositivo.
  useEffect(() => {
    if (status !== 'signedIn') return;
    let cancelled = false;
    api
      .get<CoachStoredMessage[]>('/coach/messages')
      .then((stored) => {
        if (cancelled) return;
        // Si el usuario ya ha escrito algo mientras tanto, no se pisa lo que lleva en pantalla.
        setMessages((current) =>
          current.length > 0
            ? current
            : stored.map((m) => ({ id: m.id, role: m.role === 'user' ? 'user' : 'coach', text: m.content })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  const refreshUsage = useCallback(async () => {
    try {
      setUsage(await api.get<CoachUsage>('/coach/usage'));
    } catch {
      // El uso es informativo: si falla, se queda lo que había.
    }
  }, []);
  useEffect(() => {
    if (status === 'signedIn') void refreshUsage();
  }, [status, refreshUsage]);

  const firstName = profile.name?.trim().split(/\s+/)[0] ?? null;
  const greeting = firstName ? `Hola ${firstName}, ¿en qué puedo ayudarte?` : 'Hola, ¿en qué puedo ayudarte?';

  const stop = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
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
      const userMessage: CoachMessage = { id: newId(), role: 'user', text };
      const reply: CoachMessage = { id: newId(), role: 'coach', text: '', streaming: true };
      setMessages((prev) => [...prev, userMessage, reply]);
      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;
      void (async () => {
        let result: { text: string; error?: boolean };
        try {
          const { reply: answer } = await api.post<CoachReply>('/coach/chat', { message: text });
          result = { text: answer };
        } catch (e) {
          // El servidor ya manda el mensaje listo para enseñar («Has llegado al límite de este mes…»).
          result = {
            text: e instanceof ApiError ? e.message : 'No he podido responder ahora mismo. Inténtalo de nuevo.',
            error: true,
          };
        }
        // Si se cerró el chat mientras tanto, la respuesta se descarta (la llamada ya se ha hecho y se ha cobrado).
        if (!controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) => (m.id === reply.id ? { ...m, text: result.text, error: result.error, streaming: false } : m)),
          );
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== reply.id));
        }
        // Si se cortó antes (`stop`), ya está libre y quizá haya otra llamada en curso: no tocar nada.
        if (abort.current === controller) {
          abort.current = null;
          setBusy(false);
        }
        void refreshUsage();
      })();
    },
    [refreshUsage],
  );

  const clearConversation = useCallback(async () => {
    stop();
    await api.delete('/coach/messages');
    setMessages([]);
    setExpanded(false);
  }, [stop]);

  const value = useMemo<CoachValue>(
    () => ({
      open,
      setOpen,
      expanded,
      setExpanded,
      messages,
      greeting,
      busy,
      excited: busy || poked,
      send,
      stop,
      clearConversation,
      usage,
      refreshUsage,
    }),
    [open, setOpen, expanded, messages, greeting, busy, poked, send, stop, clearConversation, usage, refreshUsage],
  );
  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach(): CoachValue {
  const value = useContext(CoachContext);
  if (!value) throw new Error('useCoach debe usarse dentro de CoachProvider');
  return value;
}
