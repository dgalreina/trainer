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
  type CreateDiet,
  type CreateMeal,
  type UpdateDiet,
  type UpdateMeal,
  createDietSchema,
  createMealSchema,
  updateDietSchema,
  updateMealSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { DietsService } from "./diets.service.js";

@Controller("diets")
export class DietsController {
  constructor(private readonly diets: DietsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.diets.list(user.userId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.diets.get(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createDietSchema)) body: CreateDiet) {
    return this.diets.create(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateDietSchema)) body: UpdateDiet,
  ) {
    return this.diets.update(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.diets.remove(user.userId, id);
  }

  // Las comidas solo existen dentro de una dieta; cada operación devuelve la dieta
  // completa, ya actualizada.
  @Post(":id/meals")
  addMeal(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(createMealSchema)) body: CreateMeal,
  ) {
    return this.diets.addMeal(user.userId, id, body);
  }

  @Patch(":id/meals/:mealId")
  updateMeal(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("mealId") mealId: string,
    @Body(new ZodPipe(updateMealSchema)) body: UpdateMeal,
  ) {
    return this.diets.updateMeal(user.userId, id, mealId, body);
  }

  @Delete(":id/meals/:mealId")
  removeMeal(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("mealId") mealId: string,
  ) {
    return this.diets.removeMeal(user.userId, id, mealId);
  }
}
