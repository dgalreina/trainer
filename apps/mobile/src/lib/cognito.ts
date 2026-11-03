import { config } from '@/config';

// Cliente mínimo de la API pública de Cognito (sin SDK): funciona igual en web,
// iOS y Android, sin polyfills. La contraseña viaja solo por HTTPS a Cognito.

export class CognitoError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  NotAuthorizedException: 'Email o contraseña incorrectos',
  UserNotFoundException: 'Email o contraseña incorrectos',
  UserNotConfirmedException: 'Falta confirmar el email',
  UsernameExistsException: 'Ya existe una cuenta con ese email',
  InvalidPasswordException:
    'La contraseña debe tener al menos 10 caracteres, con mayúsculas, minúsculas y números',
  CodeMismatchException: 'El código no es correcto',
  ExpiredCodeException: 'El código ha caducado, pide uno nuevo',
  LimitExceededException: 'Demasiados intentos, espera un poco',
  TooManyRequestsException: 'Demasiados intentos, espera un poco',
  InvalidParameterException: 'Revisa el email y la contraseña',
};

async function call<T>(target: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://cognito-idp.${config.cognito.region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify({ ClientId: config.cognito.clientId, ...body }),
    });
  } catch {
    throw new CognitoError('NetworkError', 'Sin conexión');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(data.__type ?? 'UnknownError').split('#').pop()!;
    throw new CognitoError(code, MESSAGES[code] ?? 'No se ha podido completar la operación');
  }
  return data as T;
}

export interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  /** Instante (ms) en que caduca el access token. */
  expiresAt: number;
}

interface AuthResult {
  AuthenticationResult: {
    AccessToken: string;
    IdToken: string;
    RefreshToken?: string;
    ExpiresIn: number;
  };
}

function toTokens(res: AuthResult, fallbackRefresh?: string): Tokens {
  const r = res.AuthenticationResult;
  return {
    accessToken: r.AccessToken,
    idToken: r.IdToken,
    refreshToken: r.RefreshToken ?? fallbackRefresh ?? '',
    expiresAt: Date.now() + r.ExpiresIn * 1000,
  };
}

export async function signIn(email: string, password: string): Promise<Tokens> {
  const res = await call<AuthResult>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  return toTokens(res);
}

/** Renueva el access token. Cognito no devuelve un refresh token nuevo: se conserva el actual. */
export async function refresh(refreshToken: string): Promise<Tokens> {
  const res = await call<AuthResult>('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  return toTokens(res, refreshToken);
}

export async function signUp(email: string, password: string): Promise<void> {
  await call('SignUp', {
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await call('ConfirmSignUp', { Username: email, ConfirmationCode: code });
}

export async function resendCode(email: string): Promise<void> {
  await call('ResendConfirmationCode', { Username: email });
}
