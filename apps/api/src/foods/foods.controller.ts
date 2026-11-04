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
  type CreateFood,
  type UpdateFood,
  createFoodSchema,
  updateFoodSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { FoodsService } from "./foods.service.js";

@Controller("foods")
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("q") q?: string) {
    return this.foods.list(user.userId, q);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createFoodSchema)) body: CreateFood,
  ) {
    return this.foods.create(user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateFoodSchema)) body: UpdateFood,
  ) {
    return this.foods.update(user.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    await this.foods.archive(user.userId, id);
  }
}
