import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExerciseDoc, ExerciseSchema } from "./exercise.schema.js";
import { ExercisesController } from "./exercises.controller.js";
import { ExercisesService } from "./exercises.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExerciseDoc.name, schema: ExerciseSchema }]),
  ],
  controllers: [ExercisesController],
  providers: [ExercisesService],
})
export class ExercisesModule {}
