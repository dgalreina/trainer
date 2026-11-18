import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import {
  type AcceptProposal,
  type CoachJob,
  type CoachJobStarted,
  type CoachReview,
  type CoachReviewJob,
  type CoachReviewStarted,
  type CoachSend,
  type CoachStoredMessage,
  type CoachUsage,
  type Diet,
  type Training,
  type StartReview,
  type UpdateSuggestion,
  acceptProposalSchema,
  coachSendSchema,
  startReviewSchema,
  updateSuggestionSchema,
} from "@trainer/shared";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CoachService } from "./coach.service.js";
import { CoachProposalsService } from "./proposals/coach-proposals.service.js";
import { CoachReviewService } from "./review/coach-review.service.js";

@Controller("coach")
export class CoachController {
  constructor(
    private readonly coach: CoachService,
    private readonly proposals: CoachProposalsService,
    private readonly reviews: CoachReviewService,
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
    await this.reviews.clearAll(user.userId);
  }

  /** La app avisa de que ha guardado un entreno: se analiza en segundo plano (si el plan incluye IA). */
  @Post("reviews")
  @HttpCode(202)
  startReview(@CurrentUser() user: AuthUser, @Body(new ZodPipe(startReviewSchema)) body: StartReview): Promise<CoachReviewStarted> {
    return this.reviews.start(user, body.sessionId);
  }

  /** Las mejoras pendientes de la última vez que hizo esta rutina (null si no hay). Va antes que `reviews/:id`. */
  @Get("reviews/pending")
  pendingReview(@CurrentUser() user: AuthUser, @Query("routineId") routineId?: string): Promise<CoachReview | null> {
    return routineId ? this.reviews.pending(user.userId, routineId) : Promise.resolve(null);
  }

  /** Cómo va un análisis. */
  @Get("reviews/:id")
  review(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<CoachReviewJob> {
    return this.reviews.job(user.userId, id);
  }

  /** El usuario cumple o descarta una mejora. */
  @Post("reviews/:id/suggestions/:suggestionId")
  @HttpCode(204)
  async setSuggestion(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("suggestionId") suggestionId: string,
    @Body(new ZodPipe(updateSuggestionSchema)) body: UpdateSuggestion,
  ): Promise<void> {
    await this.reviews.setSuggestion(user.userId, id, suggestionId, body.status);
  }

  /** El usuario acepta la propuesta (entrenamiento o dieta): se crea de verdad (y, si quiere, pasa a ser la actual). */
  @Post("proposals/:id/accept")
  accept(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(acceptProposalSchema)) body: AcceptProposal,
  ): Promise<Training | Diet> {
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
