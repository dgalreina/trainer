import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CognitoAuthGuard } from "./cognito-auth.guard.js";

@Module({
  providers: [{ provide: APP_GUARD, useClass: CognitoAuthGuard }],
})
export class AuthModule {}
