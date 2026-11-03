import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TrainingDoc, TrainingSchema } from "../trainings/training.schema.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsDoc, SettingsSchema } from "./settings.schema.js";
import { SettingsService } from "./settings.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SettingsDoc.name, schema: SettingsSchema },
      // Solo el modelo, para comprobar que el entrenamiento activo existe y es del usuario.
      { name: TrainingDoc.name, schema: TrainingSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
