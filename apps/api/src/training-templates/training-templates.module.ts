import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExerciseDoc, ExerciseSchema } from "../exercises/exercise.schema.js";
import { TrainingsModule } from "../trainings/trainings.module.js";
import { TrainingTemplateDoc, TrainingTemplateSchema } from "./training-template.schema.js";
import { TrainingTemplatesController } from "./training-templates.controller.js";
import { TrainingTemplatesService } from "./training-templates.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrainingTemplateDoc.name, schema: TrainingTemplateSchema },
      { name: ExerciseDoc.name, schema: ExerciseSchema },
    ]),
    TrainingsModule,
  ],
  controllers: [TrainingTemplatesController],
  providers: [TrainingTemplatesService],
})
export class TrainingTemplatesModule {}
