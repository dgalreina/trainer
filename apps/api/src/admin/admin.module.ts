import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CoachModule } from "../coach/coach.module.js";
import { AppSuggestionDoc, AppSuggestionSchema } from "../coach/proposals/app-suggestion.schema.js";
import { ProfileDoc, ProfileSchema } from "../profile/profile.schema.js";
import { SettingsModule } from "../settings/settings.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminGuard } from "./admin.guard.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [CoachModule, SettingsModule, MongooseModule.forFeature([
      { name: ProfileDoc.name, schema: ProfileSchema },
      { name: AppSuggestionDoc.name, schema: AppSuggestionSchema },
    ])],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
