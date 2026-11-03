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
  type CreateExercise,
  type UpdateExercise,
  createExerciseSchema,
  updateExerciseSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ExercisesService } from "./exercises.service.js";

@Controller("exercises")
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("q") q?: string) {
    return this.exercises.list(user.userId, q);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createExerciseSchema)) body: CreateExercise,
  ) {
    return this.exercises.findOrCreate(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateExerciseSchema)) body: UpdateExercise,
  ) {
    return this.exercises.update(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.exercises.archive(user.userId, id);
  }
}
