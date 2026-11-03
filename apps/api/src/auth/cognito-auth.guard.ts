import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { Request } from "express";
import type { AuthUser } from "./current-user.decorator.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

type Verifier = ReturnType<typeof createVerifier>;

function createVerifier() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new Error("Faltan COGNITO_USER_POOL_ID o COGNITO_CLIENT_ID");
  }
  return CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: "access" });
}

/**
 * Guard global: valida el access token de Cognito (firma, caducidad,
 * user pool y app client). Se aplica a todo salvo lo marcado con @Public().
 */
@Injectable()
export class CognitoAuthGuard implements CanActivate {
  // Perezoso y en la instancia: la caché de claves públicas (JWKS) se
  // reutiliza entre invocaciones de Lambda.
  private verifier?: Verifier;

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Falta el token");
    }

    this.verifier ??= createVerifier();
    try {
      const payload = await this.verifier.verify(token);
      req.user = { userId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException("Token no válido");
    }
  }
}
