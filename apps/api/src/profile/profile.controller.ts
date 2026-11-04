import { Body, Controller, Get, Put } from "@nestjs/common";
import { type UpdateProfile, updateProfileSchema } from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ProfileService } from "./profile.service.js";

@Controller("me/profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.profile.get(user.userId);
  }

  @Put()
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfile,
  ) {
    return this.profile.update(user.userId, body);
  }
}
