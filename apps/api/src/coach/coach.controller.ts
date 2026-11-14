import { Body, Controller, Get, Post } from "@nestjs/common";
import { type CoachChat, type CoachReply, type CoachUsage, coachChatSchema } from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CoachService } from "./coach.service.js";

@Controller("coach")
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Post("chat")
  async chat(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(coachChatSchema)) body: CoachChat,
  ): Promise<CoachReply> {
    return { reply: await this.coach.chat(user, body.messages) };
  }

  @Get("usage")
  usage(@CurrentUser() user: AuthUser): Promise<CoachUsage> {
    return this.coach.monthUsage(user);
  }
}
