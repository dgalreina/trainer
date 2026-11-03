import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  type CreateRoutine,
  type CreateTraining,
  type UpdateRoutine,
  type UpdateTraining,
  createRoutineSchema,
  createTrainingSchema,
  updateRoutineSchema,
  updateTrainingSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { TrainingsService } from "./trainings.service.js";

@Controller("trainings")
export class TrainingsController {
  constructor(private readonly trainings: TrainingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.trainings.list(user.userId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.trainings.get(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createTrainingSchema)) body: CreateTraining,
  ) {
    return this.trainings.create(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateTrainingSchema)) body: UpdateTraining,
  ) {
    return this.trainings.update(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.trainings.remove(user.userId, id);
  }

  // Las rutinas solo existen dentro de un entrenamiento; cada operación devuelve el
  // entrenamiento completo, ya actualizado.
  @Post(":id/routines")
  addRoutine(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(createRoutineSchema)) body: CreateRoutine,
  ) {
    return this.trainings.addRoutine(user.userId, id, body);
  }

  @Patch(":id/routines/:routineId")
  updateRoutine(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("routineId") routineId: string,
    @Body(new ZodPipe(updateRoutineSchema)) body: UpdateRoutine,
  ) {
    return this.trainings.updateRoutine(user.userId, id, routineId, body);
  }

  @Delete(":id/routines/:routineId")
  removeRoutine(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("routineId") routineId: string,
  ) {
    return this.trainings.removeRoutine(user.userId, id, routineId);
  }
}
