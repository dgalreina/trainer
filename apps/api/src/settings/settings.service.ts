import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  AI_PLANS,
  type AiPlan,
  type DietScheduleEntry,
  type UpdateUserSettings,
  type UserSettings,
} from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { DietDoc } from "../diets/diet.schema.js";
import { TrainingDoc } from "../trainings/training.schema.js";
import { SettingsDoc } from "./settings.schema.js";

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(SettingsDoc.name) private readonly model: Model<SettingsDoc>,
    @InjectModel(TrainingDoc.name) private readonly trainings: Model<TrainingDoc>,
    @InjectModel(DietDoc.name) private readonly diets: Model<DietDoc>,
  ) {}

  async get(userId: string): Promise<UserSettings> {
    const doc = await this.model.findOne({ userId });
    const activeDietId = doc?.activeDietId ?? null;
    let dietSchedule: DietScheduleEntry[] = (doc?.dietSchedule ?? []).map((e) => ({
      from: e.from,
      dietId: e.dietId ?? null,
    }));
    // Quien activó una dieta antes de que existiera el calendario: rige desde su fecha de inicio.
    if (dietSchedule.length === 0 && activeDietId && isValidObjectId(activeDietId)) {
      const diet = await this.diets.findOne({ _id: activeDietId, userId }).lean();
      if (diet) dietSchedule = [{ from: diet.startDate, dietId: activeDietId }];
    }
    return {
      activeTrainingId: doc?.activeTrainingId ?? null,
      activeDietId,
      dietSchedule,
      routinesResetAt: doc?.routinesResetAt ? doc.routinesResetAt.toISOString() : null,
      extraBurnKcal: doc?.extraBurnKcal ?? null,
      extraBurnAuto: doc?.extraBurnAuto ?? true,
    };
  }

  /** El plan de IA del usuario. Sin dato, `gratis` (sin acceso). */
  async aiPlan(userId: string): Promise<AiPlan> {
    const doc = await this.model.findOne({ userId }).lean();
    return AI_PLANS.find((p) => p === doc?.aiPlan) ?? "gratis";
  }

  /** Cambia el plan de IA (solo desde el panel de administración: la app normal no puede). */
  async setAiPlan(userId: string, plan: AiPlan): Promise<void> {
    await this.model.updateOne({ userId }, { $set: { aiPlan: plan } }, { upsert: true });
  }

  /** El plan guardado de varios usuarios a la vez. */
  async aiPlans(userIds: string[]): Promise<Map<string, AiPlan>> {
    const docs = await this.model.find({ userId: { $in: userIds } }).lean();
    return new Map(docs.map((d) => [d.userId, AI_PLANS.find((p) => p === d.aiPlan) ?? "gratis"]));
  }

  async update(userId: string, dto: UpdateUserSettings): Promise<UserSettings> {
    if (dto.activeTrainingId) {
      const exists =
        isValidObjectId(dto.activeTrainingId) &&
        (await this.trainings.exists({ _id: dto.activeTrainingId, userId }));
      if (!exists) throw new BadRequestException("Ese entrenamiento no existe");
    }
    if (dto.activeDietId) {
      const exists =
        isValidObjectId(dto.activeDietId) &&
        (await this.diets.exists({ _id: dto.activeDietId, userId }));
      if (!exists) throw new BadRequestException("Esa dieta no existe");
    }
    const { dietSince, routinesResetAt, ...changes } = dto;
    const set: Record<string, unknown> = { ...changes };
    if (routinesResetAt !== undefined) set.routinesResetAt = routinesResetAt ? new Date(routinesResetAt) : null;
    // Al cambiar de entrenamiento actual empieza un ciclo nuevo de rutinas hechas.
    if (dto.activeTrainingId !== undefined && routinesResetAt === undefined) {
      const current = await this.model.findOne({ userId }).lean();
      if ((current?.activeTrainingId ?? null) !== dto.activeTrainingId) set.routinesResetAt = new Date();
    }
    if (dto.activeDietId !== undefined) {
      // Desde ese día rige la dieta nueva (o ninguna); lo anterior se conserva y lo posterior se descarta.
      const since = dietSince ?? new Date().toISOString().slice(0, 10);
      const current = (await this.get(userId)).dietSchedule;
      set.dietSchedule = [
        ...current.filter((e) => e.from < since),
        { from: since, dietId: dto.activeDietId },
      ];
    }
    await this.model.updateOne({ userId }, { $set: set }, { upsert: true });
    return this.get(userId);
  }

  /** Si se borra la dieta que estaba activa, deja de haber una activa. */
  async clearActiveDiet(userId: string, dietId: string): Promise<void> {
    await this.model.updateOne({ userId, activeDietId: dietId }, { $set: { activeDietId: null } });
  }

  /** Si se borra el entrenamiento que estaba activo, deja de haber uno activo. */
  async clearActiveTraining(userId: string, trainingId: string): Promise<void> {
    await this.model.updateOne(
      { userId, activeTrainingId: trainingId },
      { $set: { activeTrainingId: null } },
    );
  }
}
