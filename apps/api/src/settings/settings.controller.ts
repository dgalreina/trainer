import { Body, Controller, Get, Put } from "@nestjs/common";
import { type UpdateUserSettings, updateUserSettingsSchema } from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { SettingsService } from "./settings.service.js";

@Controller("me/settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settings.get(user.userId);
  }

  @Put()
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateUserSettingsSchema)) body: UpdateUserSettings,
  ) {
    return this.settings.update(user.userId, body);
  }
}
