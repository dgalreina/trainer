import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { UpdateUserSettings, UserSettings } from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { TrainingDoc } from "../trainings/training.schema.js";
import { SettingsDoc } from "./settings.schema.js";

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(SettingsDoc.name) private readonly model: Model<SettingsDoc>,
    @InjectModel(TrainingDoc.name) private readonly trainings: Model<TrainingDoc>,
  ) {}

  async get(userId: string): Promise<UserSettings> {
    const doc = await this.model.findOne({ userId });
    return {
      activeTrainingId: doc?.activeTrainingId ?? null,
      activeDietId: doc?.activeDietId ?? null,
    };
  }

  async update(userId: string, dto: UpdateUserSettings): Promise<UserSettings> {
    if (dto.activeTrainingId) {
      const exists =
        isValidObjectId(dto.activeTrainingId) &&
        (await this.trainings.exists({ _id: dto.activeTrainingId, userId }));
      if (!exists) throw new BadRequestException("Ese entrenamiento no existe");
    }
    await this.model.updateOne({ userId }, { $set: dto }, { upsert: true });
    return this.get(userId);
  }

  /** Si se borra el entrenamiento que estaba activo, deja de haber uno activo. */
  async clearActiveTraining(userId: string, trainingId: string): Promise<void> {
    await this.model.updateOne(
      { userId, activeTrainingId: trainingId },
      { $set: { activeTrainingId: null } },
    );
  }
}
