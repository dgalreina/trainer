import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  type CreateWeightEntry,
  type UpdateWeightEntry,
  createWeightEntrySchema,
  updateWeightEntrySchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { parseQueryDate } from "../common/query-date.js";
import { WeightsService } from "./weights.service.js";

@Controller("me/weights")
export class WeightsController {
  constructor(private readonly weights: WeightsService) {}

  // `from` incluido, `to` excluido (ISO 8601). Sin ellos, los últimos 60 días.
  @Get()
  list(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.weights.list(user.userId, parseQueryDate(from, "from"), parseQueryDate(to, "to"));
  }

  // Declarado antes que cualquier ruta con :id para que "latest" no se tome por un id.
  @Get("latest")
  latest(@CurrentUser() user: AuthUser) {
    return this.weights.latest(user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createWeightEntrySchema)) body: CreateWeightEntry,
  ) {
    return this.weights.create(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateWeightEntrySchema)) body: UpdateWeightEntry,
  ) {
    return this.weights.update(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.weights.remove(user.userId, id);
  }
}
