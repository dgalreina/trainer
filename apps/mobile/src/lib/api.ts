import { config } from '@/config';

type TokenProvider = () => Promise<string | null>;

let getToken: TokenProvider = async () => null;

/** Lo registra AuthProvider: así la API no depende de React. */
export function setTokenProvider(provider: TokenProvider): void {
  getToken = provider;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new ApiError(401, 'Sesión caducada');

  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = typeof data.message === 'string' ? data.message : 'Error del servidor';
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  // Un `null` del servidor llega como cuerpo vacío (p. ej. «último peso» sin ninguna pesada): no es un error.
  const raw = await res.text();
  return (raw ? JSON.parse(raw) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  /** Casi todos los borrados no devuelven nada (204); algunos devuelven el recurso padre actualizado. */
  delete: <T = void>(path: string) => request<T>('DELETE', path),
};
