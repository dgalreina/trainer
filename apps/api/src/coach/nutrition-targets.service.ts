import { Injectable } from "@nestjs/common";
import { type DailyTargets, type DietLimits, type Goal, calculateTargets, dietLimits, missingTargetData } from "@trainer/shared";
import { ProfileService } from "../profile/profile.service.js";
import { WeightsService } from "../weights/weights.service.js";

export type NutritionTargets =
  | { missing: string[] }
  | { goal: Goal; targets: DailyTargets; limits: DietLimits };

/**
 * Las calorías orientativas y los topes duros de una dieta para este usuario. Los calcula el código con los datos de
 * «Yo» y su último peso: el entrenador los consulta y reparte comidas dentro de ellos, pero no los fija.
 */
@Injectable()
export class NutritionTargetsService {
  constructor(
    private readonly profile: ProfileService,
    private readonly weights: WeightsService,
  ) {}

  async forUser(userId: string, goal?: Goal): Promise<NutritionTargets> {
    const [profile, weight] = await Promise.all([this.profile.get(userId), this.weights.latest(userId)]);
    const input = {
      sex: profile.sex,
      birthDate: profile.birthDate,
      heightCm: profile.heightCm,
      activityLevel: profile.activityLevel,
      weightKg: weight?.weightKg ?? null,
    };
    const missing = missingTargetData(input);
    const chosen = goal ?? profile.goal;
    if (!chosen) missing.push("objetivo");
    if (missing.length > 0) return { missing };

    const full = { ...input, goal: chosen as Goal, today: new Date().toISOString().slice(0, 10) };
    const targets = calculateTargets(full);
    const limits = dietLimits(full);
    if (!targets || !limits) return { missing: ["datos del perfil"] };
    return { goal: chosen as Goal, targets, limits };
  }
}
