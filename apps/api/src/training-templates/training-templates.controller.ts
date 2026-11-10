import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { type UseTemplate, useTemplateSchema } from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { TrainingTemplatesService } from "./training-templates.service.js";

@Controller("training-templates")
export class TrainingTemplatesController {
  constructor(private readonly templates: TrainingTemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  /** Copia la plantilla a los entrenamientos del usuario y devuelve el entrenamiento creado. */
  @Post(":id/use")
  use(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(useTemplateSchema)) body: UseTemplate,
  ) {
    return this.templates.use(user.userId, id, body);
  }
}
