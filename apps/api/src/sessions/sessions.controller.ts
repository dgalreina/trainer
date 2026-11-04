import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  type CreateWorkoutSession,
  type UpdateWorkoutSession,
  createWorkoutSessionSchema,
  updateWorkoutSessionSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { parseQueryDate } from "../common/query-date.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { SessionsService } from "./sessions.service.js";

@Controller("sessions")
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("limit") limit?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.sessions.list(
      user.userId,
      Number.isNaN(parsed) ? undefined : parsed,
      parseQueryDate(from, "from"),
      parseQueryDate(to, "to"),
    );
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.sessions.get(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createWorkoutSessionSchema)) body: CreateWorkoutSession,
  ) {
    return this.sessions.create(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateWorkoutSessionSchema)) body: UpdateWorkoutSession,
  ) {
    return this.sessions.update(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.sessions.remove(user.userId, id);
  }
}
