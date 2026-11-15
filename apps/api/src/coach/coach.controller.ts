import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import {
  type AcceptProposal,
  type CoachJob,
  type CoachJobStarted,
  type CoachSend,
  type CoachStoredMessage,
  type CoachUsage,
  type Training,
  acceptProposalSchema,
  coachSendSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CoachService } from "./coach.service.js";
import { CoachProposalsService } from "./proposals/coach-proposals.service.js";

@Controller("coach")
export class CoachController {
  constructor(
    private readonly coach: CoachService,
    private readonly proposals: CoachProposalsService,
  ) {}

  /** Empieza a contestar un mensaje (en segundo plano) y devuelve el `jobId` por el que preguntar. */
  @Post("chat")
  @HttpCode(202)
  chat(@CurrentUser() user: AuthUser, @Body(new ZodPipe(coachSendSchema)) body: CoachSend): Promise<CoachJobStarted> {
    return this.coach.startChat(user, body.message);
  }

  /** Cómo va un mensaje: en marcha, contestado (con la propuesta de entrenamiento si la hay) o con error. */
  @Get("jobs/:id")
  job(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<CoachJob> {
    return this.coach.job(user.userId, id);
  }

  /** La conversación guardada, para enseñarla al abrir la app. */
  @Get("messages")
  messages(@CurrentUser() user: AuthUser): Promise<CoachStoredMessage[]> {
    return this.coach.messages(user.userId);
  }

  /** Borra toda la conversación (el usuario empieza de cero). */
  @Delete("messages")
  @HttpCode(204)
  async clear(@CurrentUser() user: AuthUser): Promise<void> {
    await this.coach.clearConversation(user.userId);
  }

  /** El usuario acepta el entrenamiento propuesto: se crea de verdad (y, si quiere, pasa a ser el actual). */
  @Post("proposals/:id/accept")
  accept(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(acceptProposalSchema)) body: AcceptProposal,
  ): Promise<Training> {
    return this.proposals.accept(user.userId, id, body);
  }

  /** El usuario descarta la propuesta. */
  @Post("proposals/:id/reject")
  @HttpCode(204)
  async reject(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    await this.proposals.reject(user.userId, id);
  }

  @Get("usage")
  usage(@CurrentUser() user: AuthUser): Promise<CoachUsage> {
    return this.coach.monthUsage(user);
  }
}
