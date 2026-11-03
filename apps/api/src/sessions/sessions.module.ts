import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExercisesModule } from "../exercises/exercises.module.js";
import { SessionDoc, SessionSchema } from "./session.schema.js";
import { SessionsController } from "./sessions.controller.js";
import { SessionsService } from "./sessions.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SessionDoc.name, schema: SessionSchema }]),
    ExercisesModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
