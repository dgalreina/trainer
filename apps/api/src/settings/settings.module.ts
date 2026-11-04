import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DietDoc, DietSchema } from "../diets/diet.schema.js";
import { TrainingDoc, TrainingSchema } from "../trainings/training.schema.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsDoc, SettingsSchema } from "./settings.schema.js";
import { SettingsService } from "./settings.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SettingsDoc.name, schema: SettingsSchema },
      // Solo los modelos, para comprobar que el entrenamiento y la dieta activos existen y son del usuario.
      { name: TrainingDoc.name, schema: TrainingSchema },
      { name: DietDoc.name, schema: DietSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
