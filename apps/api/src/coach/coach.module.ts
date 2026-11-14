import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProfileModule } from "../profile/profile.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { TrainingsModule } from "../trainings/trainings.module.js";
import { WeightsModule } from "../weights/weights.module.js";
import { CoachContextService } from "./coach-context.service.js";
import { CoachConversationService } from "./coach-conversation.service.js";
import { CoachMessageDoc, CoachMessageSchema } from "./coach-message.schema.js";
import { CoachUsageDoc, CoachUsageSchema } from "./coach-usage.schema.js";
import { CoachUsageService } from "./coach-usage.service.js";
import { CoachController } from "./coach.controller.js";
import { CoachService } from "./coach.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CoachUsageDoc.name, schema: CoachUsageSchema },
      { name: CoachMessageDoc.name, schema: CoachMessageSchema },
    ]),
    ProfileModule,
    SettingsModule,
    TrainingsModule,
    WeightsModule,
  ],
  controllers: [CoachController],
  providers: [CoachService, CoachContextService, CoachConversationService, CoachUsageService],
  // Sin dependencia de HTTP: la Lambda del chat con streaming reutilizará CoachService.
  exports: [CoachService],
})
export class CoachModule {}
