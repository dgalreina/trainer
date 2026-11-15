import { Body, Controller, Get, HttpCode, Param, Patch, Query, UseGuards } from "@nestjs/common";
import {
  type AdminOverview,
  type AdminPlanUpdate,
  type AppSuggestion,
  type SuggestionStatusUpdate,
  adminPlanSchema,
  suggestionStatusSchema,
} from "@trainer/shared";
import { ZodPipe } from "../common/zod.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { AdminService } from "./admin.service.js";

@Controller("admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Todos los usuarios con su gasto de IA del mes. */
  @Get("users")
  users(): Promise<AdminOverview> {
    return this.admin.overview();
  }

  /** Lo que la IA quiso hacer y la app no pudo representar (`?resolved=1` para las ya resueltas). */
  @Get("suggestions")
  suggestions(@Query("resolved") resolved?: string): Promise<AppSuggestion[]> {
    return this.admin.suggestions(resolved === "1");
  }

  @Patch("suggestions/:id")
  @HttpCode(204)
  async setSuggestionStatus(
    @Param("id") id: string,
    @Body(new ZodPipe(suggestionStatusSchema)) body: SuggestionStatusUpdate,
  ): Promise<void> {
    await this.admin.setSuggestionStatus(id, body.status);
  }

  /** Cambia el plan de IA de un usuario. */
  @Patch("users/:userId/plan")
  @HttpCode(204)
  async setPlan(
    @Param("userId") userId: string,
    @Body(new ZodPipe(adminPlanSchema)) body: AdminPlanUpdate,
  ): Promise<void> {
    await this.admin.setPlan(userId, body.plan);
  }
}
