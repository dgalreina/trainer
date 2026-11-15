import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "../auth/current-user.decorator.js";

/** Solo deja pasar a los administradores (grupo `admin` de Cognito, que viaja firmado en el token). Va después del guard global de login. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (!user?.isAdmin) throw new ForbiddenException("Solo para administradores");
    return true;
  }
}
