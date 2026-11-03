import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@trainer/shared";
import { Public } from "./auth/public.decorator.js";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check(): HealthResponse {
    return { status: "ok", time: new Date().toISOString() };
  }
}
