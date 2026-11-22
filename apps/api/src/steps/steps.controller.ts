import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import {
  type CreateStepEntry,
  type UpdateStepEntry,
  createStepEntrySchema,
  updateStepEntrySchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { parseQueryDate } from "../common/query-date.js";
import { StepsService } from "./steps.service.js";

@Controller("me/steps")
export class StepsController {
  constructor(private readonly steps: StepsService) {}

  // `from` incluido, `to` excluido (ISO 8601). Sin ellos, los últimos 60 días.
  @Get()
  list(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.steps.list(user.userId, parseQueryDate(from, "from"), parseQueryDate(to, "to"));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createStepEntrySchema)) body: CreateStepEntry) {
    return this.steps.create(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateStepEntrySchema)) body: UpdateStepEntry,
  ) {
    return this.steps.update(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.steps.remove(user.userId, id);
  }
}
