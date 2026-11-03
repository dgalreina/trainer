import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExercisesModule } from "../exercises/exercises.module.js";
import { RoutineDoc, RoutineSchema } from "./routine.schema.js";
import { RoutinesController } from "./routines.controller.js";
import { RoutinesService } from "./routines.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RoutineDoc.name, schema: RoutineSchema }]),
    ExercisesModule,
  ],
  controllers: [RoutinesController],
  providers: [RoutinesService],
})
export class RoutinesModule {}
