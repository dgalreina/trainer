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

import { setTokenProvider } from '@/lib/api';
import * as cognito from '@/lib/cognito';
import { deleteItem, getItem, setItem } from '@/lib/storage';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: Status;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SESSION_KEY = 'trainer.session';
// Margen para no usar un access token a punto de caducar.
const EXPIRY_MARGIN_MS = 60_000;

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const tokens = useRef<cognito.Tokens | null>(null);
  const refreshing = useRef<Promise<cognito.Tokens> | null>(null);

  // Solo se guarda el refresh token (y el email): el access token vive en memoria y
  // se renueva al arrancar. Así el llavero no guarda tokens grandes ni de corta vida.
  const startSession = useCallback(async (next: cognito.Tokens, userEmail: string) => {
    tokens.current = next;
    setEmail(userEmail);
    setStatus('signedIn');
    await setItem(SESSION_KEY, JSON.stringify({ refreshToken: next.refreshToken, email: userEmail }));
  }, []);

  const signOut = useCallback(async () => {
    tokens.current = null;
    setEmail(null);
    setStatus('signedOut');
    await deleteItem(SESSION_KEY);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = tokens.current;
    if (!current) return null;
    if (current.expiresAt - Date.now() > EXPIRY_MARGIN_MS) return current.accessToken;

    // Varias peticiones a la vez comparten una sola renovación.
    refreshing.current ??= cognito.refresh(current.refreshToken).finally(() => {
      refreshing.current = null;
    });
    try {
      tokens.current = await refreshing.current;
      return tokens.current.accessToken;
    } catch (err) {
      // Token revocado o caducado: hay que volver a entrar. Un fallo de red no cierra sesión.
      if (!(err instanceof cognito.CognitoError && err.code === 'NetworkError')) await signOut();
      return null;
    }
  }, [signOut]);

  useEffect(() => {
    setTokenProvider(getAccessToken);
  }, [getAccessToken]);

  // Recupera la sesión guardada al abrir la app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await getItem(SESSION_KEY);
      try {
        const saved = raw ? (JSON.parse(raw) as { refreshToken: string; email: string }) : null;
        if (saved?.refreshToken) {
          const restored = await cognito.refresh(saved.refreshToken);
          if (!cancelled) await startSession(restored, saved.email);
          return;
        }
      } catch {
        await deleteItem(SESSION_KEY);
      }
      if (!cancelled) setStatus('signedOut');
    })();
    return () => {
      cancelled = true;
    };
  }, [startSession]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      email,
      signIn: async (userEmail, password) => {
        const normalized = userEmail.trim().toLowerCase();
        await startSession(await cognito.signIn(normalized, password), normalized);
      },
      signUp: (userEmail, password) => cognito.signUp(userEmail.trim().toLowerCase(), password),
      confirmSignUp: (userEmail, code) =>
        cognito.confirmSignUp(userEmail.trim().toLowerCase(), code.trim()),
      resendCode: (userEmail) => cognito.resendCode(userEmail.trim().toLowerCase()),
      signOut,
    }),
    [status, email, startSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
