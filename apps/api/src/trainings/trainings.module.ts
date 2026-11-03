import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExercisesModule } from "../exercises/exercises.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { TrainingDoc, TrainingSchema } from "./training.schema.js";
import { TrainingsController } from "./trainings.controller.js";
import { TrainingsService } from "./trainings.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TrainingDoc.name, schema: TrainingSchema }]),
    ExercisesModule,
    SettingsModule,
  ],
  controllers: [TrainingsController],
  providers: [TrainingsService],
})
export class TrainingsModule {}
