import { Body, Controller, Delete, Get, HttpCode, Post } from "@nestjs/common";
import {
  type CoachReply,
  type CoachSend,
  type CoachStoredMessage,
  type CoachUsage,
  coachSendSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CoachConversationService } from "./coach-conversation.service.js";
import { CoachService } from "./coach.service.js";

@Controller("coach")
export class CoachController {
  constructor(
    private readonly coach: CoachService,
    private readonly conversation: CoachConversationService,
  ) {}

  @Post("chat")
  async chat(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(coachSendSchema)) body: CoachSend,
  ): Promise<CoachReply> {
    return { reply: await this.coach.chat(user, body.message) };
  }

  /** La conversación guardada, para enseñarla al abrir la app. */
  @Get("messages")
  messages(@CurrentUser() user: AuthUser): Promise<CoachStoredMessage[]> {
    return this.conversation.list(user.userId);
  }

  /** Borra toda la conversación (el usuario empieza de cero). */
  @Delete("messages")
  @HttpCode(204)
  async clear(@CurrentUser() user: AuthUser): Promise<void> {
    await this.conversation.clear(user.userId);
  }

  @Get("usage")
  usage(@CurrentUser() user: AuthUser): Promise<CoachUsage> {
    return this.coach.monthUsage(user);
  }
}
