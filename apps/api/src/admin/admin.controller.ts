import { Body, Controller, Get, HttpCode, Param, Patch, UseGuards } from "@nestjs/common";
import { type AdminOverview, type AdminPlanUpdate, adminPlanSchema } from "@trainer/shared";
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
