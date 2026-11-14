import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface AuthUser {
  /** `sub` de Cognito: es el userId en toda la app. */
  userId: string;
  /** Está en el grupo `admin` de Cognito. Los administradores tienen siempre el plan `pro`. */
  isAdmin: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return req.user;
  },
);
