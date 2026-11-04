import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  type CreateMealLog,
  type UpdateMealLog,
  createMealLogSchema,
  updateMealLogSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { parseQueryDate } from "../common/query-date.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { MealLogsService } from "./meal-logs.service.js";

@Controller("me/meals")
export class MealLogsController {
  constructor(private readonly meals: MealLogsService) {}

  // `from` incluido, `to` excluido (ISO 8601). Sin ellos, los últimos 7 días.
  @Get()
  list(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.meals.list(user.userId, parseQueryDate(from, "from"), parseQueryDate(to, "to"));
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createMealLogSchema)) body: CreateMealLog,
  ) {
    return this.meals.create(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateMealLogSchema)) body: UpdateMealLog,
  ) {
    return this.meals.update(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.meals.remove(user.userId, id);
  }
}
