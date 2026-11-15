import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExercisesModule } from "../exercises/exercises.module.js";
import { ProfileModule } from "../profile/profile.module.js";
import { SessionsModule } from "../sessions/sessions.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { TrainingsModule } from "../trainings/trainings.module.js";
import { WeightsModule } from "../weights/weights.module.js";
import { CoachContextService } from "./coach-context.service.js";
import { CoachConversationService } from "./coach-conversation.service.js";
import { CoachMessageDoc, CoachMessageSchema } from "./coach-message.schema.js";
import { CoachUsageDoc, CoachUsageSchema } from "./coach-usage.schema.js";
import { CoachUsageService } from "./coach-usage.service.js";
import { AppSuggestionDoc, AppSuggestionSchema } from "./proposals/app-suggestion.schema.js";
import { CoachJobDoc, CoachJobSchema } from "./coach-job.schema.js";
import { CoachJobsService } from "./coach-jobs.service.js";
import { CoachProposalDoc, CoachProposalSchema } from "./proposals/coach-proposal.schema.js";
import { CoachProposalsService } from "./proposals/coach-proposals.service.js";
import { TrainingTranslator } from "./proposals/training-translator.js";
import { CoachToolsService } from "./tools/coach-tools.service.js";
import { CoachController } from "./coach.controller.js";
import { CoachService } from "./coach.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CoachUsageDoc.name, schema: CoachUsageSchema },
      { name: CoachMessageDoc.name, schema: CoachMessageSchema },
      { name: CoachJobDoc.name, schema: CoachJobSchema },
      { name: CoachProposalDoc.name, schema: CoachProposalSchema },
      { name: AppSuggestionDoc.name, schema: AppSuggestionSchema },
    ]),
    ExercisesModule,
    ProfileModule,
    SessionsModule,
    SettingsModule,
    TrainingsModule,
    WeightsModule,
  ],
  controllers: [CoachController],
  providers: [
    CoachService,
    CoachContextService,
    CoachConversationService,
    CoachJobsService,
    CoachProposalsService,
    CoachToolsService,
    CoachUsageService,
    TrainingTranslator,
  ],
  // Sin dependencia de HTTP: la Lambda del chat con streaming reutilizará CoachService.
  exports: [CoachService, CoachUsageService],
})
export class CoachModule {}
