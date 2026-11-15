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

import type { CoachJob, CoachJobStarted, CoachStoredMessage, CoachProposal, CoachUsage } from '@trainer/shared';

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
  /** El entrenamiento que el entrenador propone en este mensaje (se enseña como tarjeta). */
  proposal?: CoachProposal;
}

/** Cada cuánto se pregunta al servidor si ya hay respuesta, y cuánto se espera como máximo (ms). */
const POLL_MS = 1500;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;
/** Cuántos fallos de red seguidos se aguantan al preguntar por la respuesta. */
const POLL_MAX_FAILURES = 5;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


interface CoachValue {
  /** El chat está abierto. */
  open: boolean;
  /**
   * Abre o cierra. Al abrir, siempre sale el chat completo (con su cuadro de texto): quien pulsa el icono quiere hablar.
   * Solo con `{ greeting: true }` sale el saludo pequeño, que es para cuando el entrenador habla primero (por ejemplo,
   * tras un entreno): lo dispara un evento de la app, nunca el usuario.
   */
  setOpen: (open: boolean, options?: { greeting?: boolean }) => void;
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
  /** Cambia la propuesta de un mensaje (por ejemplo, al guardarla o descartarla). */
  updateProposal: (messageId: string, proposal: CoachProposal) => void;
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
            : stored.map((m) => ({
                id: m.id,
                role: m.role === 'user' ? 'user' : 'coach',
                text: m.content,
                proposal: m.proposal,
              })),
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
    (value: boolean, options?: { greeting?: boolean }) => {
      // Cerrar el chat NO corta la respuesta en camino: el servidor la sigue trabajando y aquí se sigue esperando, así
      // aparece al volver a abrirlo. Solo el botón de parar la descarta.
      // Al abrirlo, el icono se excita unos segundos y luego se calma solo.
      if (value) {
        setPoked(true);
        if (pokeTimer.current) clearTimeout(pokeTimer.current);
        pokeTimer.current = setTimeout(() => setPoked(false), POKE_MS);
      }
      // Abierto por el usuario: el chat entero. El saludo pequeño solo cuando habla primero el entrenador.
      setExpanded(value && !options?.greeting);
      setOpenState(value);
    },
    [],
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
        let result: { text: string; error?: boolean; proposal?: CoachProposal };
        try {
          // El chat es asíncrono: se envía el mensaje, el servidor lo trabaja en segundo plano y aquí se pregunta por él.
          const { jobId } = await api.post<CoachJobStarted>('/coach/chat', { message: text });
          const startedAt = Date.now();
          let job: CoachJob = { status: 'running' };
          let failures = 0;
          while (job.status === 'running' && !controller.signal.aborted && Date.now() - startedAt < POLL_TIMEOUT_MS) {
            await sleep(POLL_MS);
            if (controller.signal.aborted) break;
            try {
              job = await api.get<CoachJob>(`/coach/jobs/${jobId}`);
              failures = 0;
            } catch (e) {
              // Un fallo puntual de red no es el fin: el servidor sigue trabajando. Se rinde tras varios seguidos.
              if (++failures >= POLL_MAX_FAILURES) throw e;
            }
          }
          if (job.status === 'done') result = { text: job.reply ?? '', proposal: job.proposal };
          else if (job.status === 'error') result = { text: job.error?.message ?? 'No he podido responder.', error: true };
          else result = { text: 'Está tardando más de lo normal. Vuelve a abrir el chat en un momento.', error: true };
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
            prev.map((m) =>
              m.id === reply.id
                ? { ...m, text: result.text, error: result.error, proposal: result.proposal, streaming: false }
                : m,
            ),
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

  const updateProposal = useCallback((messageId: string, proposal: CoachProposal) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, proposal } : m)));
  }, []);

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
      updateProposal,
      stop,
      clearConversation,
      usage,
      refreshUsage,
    }),
    [open, setOpen, expanded, messages, greeting, busy, poked, send, updateProposal, stop, clearConversation, usage, refreshUsage],
  );
  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach(): CoachValue {
  const value = useContext(CoachContext);
  if (!value) throw new Error('useCoach debe usarse dentro de CoachProvider');
  return value;
}
