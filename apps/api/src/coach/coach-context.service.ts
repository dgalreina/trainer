import { Injectable } from "@nestjs/common";
import { ageFromBirthDate, trainingProgress } from "@trainer/shared";
import { ProfileService } from "../profile/profile.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { TrainingsService } from "../trainings/trainings.service.js";
import { WeightsService } from "../weights/weights.service.js";

const label = (value: string | null) => (value ? value.replaceAll("_", " ") : null);

/**
 * La «ficha del usuario»: un texto corto y siempre al día con lo esencial (objetivo, peso, entrenamiento actual...).
 * La construye el código con datos de Mongo; a Claude le llega pegada en el prompt de sistema. Lo que no esté aquí,
 * el entrenador no lo sabe. Las cifras salen de aquí, nunca de lo que «recuerde» el modelo.
 */
@Injectable()
export class CoachContextService {
  constructor(
    private readonly profile: ProfileService,
    private readonly weights: WeightsService,
    private readonly settings: SettingsService,
    private readonly trainings: TrainingsService,
  ) {}

  async buildCard(userId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const [profile, weight, settings] = await Promise.all([
      this.profile.get(userId),
      this.weights.latest(userId),
      this.settings.get(userId),
    ]);

    const lines: string[] = [`Hoy es ${today}.`];

    const who = [
      profile.name ? `Nombre: ${profile.name}` : null,
      profile.birthDate ? `edad: ${ageFromBirthDate(profile.birthDate, today)} años` : null,
      profile.sex && profile.sex !== "no_indicado" ? `sexo: ${profile.sex}` : null,
      profile.heightCm ? `altura: ${profile.heightCm} cm` : null,
    ].filter(Boolean);
    if (who.length) lines.push(`${who.join(", ")}.`);

    if (profile.goal) lines.push(`Objetivo: ${label(profile.goal)}.`);
    if (profile.activityLevel) lines.push(`Nivel de actividad diaria: ${label(profile.activityLevel)}.`);
    lines.push(
      weight
        ? `Último peso: ${weight.weightKg} kg (${weight.date.slice(0, 10)}).`
        : "Todavía no ha registrado su peso.",
    );
    if (profile.notes) lines.push(`Lesiones y notas que te ha dado: ${profile.notes}`);

    if (settings.activeTrainingId) {
      const training = await this.trainings.get(userId, settings.activeTrainingId).catch(() => null);
      if (training) {
        const progress = trainingProgress(training, today);
        const routines = training.routines.map((r, i) => r.name || `Día ${i + 1}`).join(", ");
        lines.push(
          `Entrenamiento actual: «${training.name}», semana ${progress.week} de ${progress.totalWeeks}` +
            (routines ? `. Rutinas: ${routines}.` : "."),
        );
      }
    } else {
      lines.push("No tiene un entrenamiento asignado.");
    }

    lines.push(settings.activeDietId ? "Tiene una dieta activa." : "No tiene una dieta activa.");
    return lines.join("\n");
  }
}
