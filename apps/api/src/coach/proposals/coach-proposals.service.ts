import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  type AcceptProposal,
  type CoachProposal,
  type Diet,
  type DietDesign,
  type DietProposal,
  type Limitation,
  type Training,
  type TrainingDesign,
  type TrainingProposal,
  dietLimitProblem,
  dietProposalPayloadSchema,
  foodMacros,
  searchExercises,
  searchFoods,
  sumMacros,
  trainingProposalPayloadSchema,
} from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { DietsService } from "../../diets/diets.service.js";
import { ExercisesService } from "../../exercises/exercises.service.js";
import { FoodsService } from "../../foods/foods.service.js";
import { SettingsService } from "../../settings/settings.service.js";
import { TrainingsService } from "../../trainings/trainings.service.js";
import { AppSuggestionDoc } from "./app-suggestion.schema.js";
import { CoachProposalDoc, type CoachProposalDocument } from "./coach-proposal.schema.js";
import { NutritionTargetsService } from "../nutrition-targets.service.js";
import { DietTranslator } from "./diet-translator.js";
import { TrainingTranslator } from "./training-translator.js";

/** Cuántos ejemplos de cada sugerencia se guardan (los más recientes). */
const MAX_EXAMPLES = 5;
/** Cuántas sugerencias distintas se guardan como máximo. */
const MAX_SUGGESTION_CODES = 300;

/** Un ejercicio del diseño que se ha cambiado por otro parecido del catálogo. */
export interface Substitution {
  asked: string;
  used: string;
}

/** Un alimento del diseño que se ha cambiado por otro parecido del catálogo. */
export interface FoodSubstitution {
  asked: string;
  used: string;
}

/** Un fallo al preparar la propuesta: el texto es para Claude (que se lo explica al usuario con sus palabras). */
export class ProposalError extends Error {}

const toView = (doc: CoachProposalDocument): CoachProposal =>
  doc.kind === "diet"
    ? {
        kind: "diet",
        id: doc.id,
        status: doc.status,
        diet: doc.diet!,
        ...(doc.dietId ? { dietId: doc.dietId } : {}),
      }
    : {
        kind: "training",
        id: doc.id,
        status: doc.status,
        training: doc.training!,
        ...(doc.trainingId ? { trainingId: doc.trainingId } : {}),
      };

/**
 * Los entrenamientos que propone el entrenador. Fase 1 (diseño libre, lo manda Claude) → fase 2 (traductor al formato de
 * la app) → validación con los esquemas de `@trainer/shared` → propuesta guardada. No se convierte en entrenamiento hasta
 * que el usuario la acepta.
 */
@Injectable()
export class CoachProposalsService {
  private readonly logger = new Logger(CoachProposalsService.name);

  constructor(
    @InjectModel(CoachProposalDoc.name) private readonly model: Model<CoachProposalDoc>,
    @InjectModel(AppSuggestionDoc.name) private readonly suggestions: Model<AppSuggestionDoc>,
    private readonly exercises: ExercisesService,
    private readonly translator: TrainingTranslator,
    private readonly trainings: TrainingsService,
    private readonly settings: SettingsService,
    private readonly foods: FoodsService,
    private readonly diets: DietsService,
    private readonly dietTranslator: DietTranslator,
    private readonly targets: NutritionTargetsService,
  ) {}

  async createTraining(
    userId: string,
    design: TrainingDesign,
  ): Promise<{ proposal: TrainingProposal; substitutions: Substitution[] }> {
    const catalog = await this.exercises.list(userId);
    const nameById = new Map(catalog.map((e) => [e.id, e.name]));

    let translated;
    try {
      translated = await this.translator.translate(userId, design, catalog);
    } catch (error) {
      const code = error instanceof Error ? error.message : "translator_error";
      throw new ProposalError(
        code === "translator_too_long"
          ? "El entrenamiento es demasiado largo para prepararlo de una vez. Propón uno con menos días o menos ejercicios."
          : "No he podido preparar el entrenamiento ahora mismo.",
      );
    }

    const routines = translated.routines.map((routine) => {
      const r = routine as { slots?: { exerciseId?: string; technique?: string }[] };
      const slots = (r.slots ?? []).map((slot, i, all) => {
        const exerciseName = slot.exerciseId ? nameById.get(slot.exerciseId) : undefined;
        if (!exerciseName) throw new ProposalError("El traductor usó un ejercicio que no existe en el catálogo.");
        // En la app el último ejercicio de una rutina no puede ir encadenado con «el siguiente».
        const technique = slot.technique === "ss" && i === all.length - 1 ? undefined : slot.technique;
        return { ...slot, technique, exerciseName };
      });
      return { ...r, slots };
    });
    // La traducción no debe añadir ni quitar días ni ejercicios: se comprueba contra el diseño.
    const sameShape =
      routines.length === design.days.length &&
      routines.every(
        (r, i) =>
          r.slots.length === design.days[i].exercises.length &&
          // Mismo número de series en cada ejercicio, y ninguno sin series.
          r.slots.every((slot, j) => {
            const sets = (slot as { sets?: unknown[] }).sets ?? [];
            return sets.length > 0 && sets.length === design.days[i].exercises[j].sets.length;
          }),
      );
    if (!sameShape) throw new ProposalError("La traducción no respetó los días y ejercicios del diseño.");

    const parsed = trainingProposalPayloadSchema.safeParse({
      // El nombre y la duración son los del diseño: el traductor no decide.
      name: design.name,
      durationWeeks: design.durationWeeks,
      routines,
    });
    if (!parsed.success) {
      this.logger.warn(`Propuesta no válida: ${JSON.stringify(parsed.error.issues).slice(0, 500)}`);
      throw new ProposalError("El entrenamiento preparado no es válido.");
    }

    const doc = await this.model.create({ userId, status: "pending", training: parsed.data });
    // Lo que no cupo va a las sugerencias de mejora (solo las ve el administrador; sin userId).
    await this.recordLimitations(translated.limitations).catch((e) =>
      this.logger.warn(`No se pudieron guardar las sugerencias: ${e instanceof Error ? e.message : String(e)}`),
    );

    // Qué ejercicios del diseño se cambiaron por otro del catálogo (los parecidos de nombre no cuentan): así el entrenador
    // puede decírselo al usuario y lo que cuenta en el chat coincide con la tarjeta.
    const substitutions: Substitution[] = [];
    design.days.forEach((day, i) =>
      day.exercises.forEach((asked, j) => {
        const used = routines[i].slots[j].exerciseName;
        if (searchExercises([{ id: "", name: used, category: "otros", ownerId: null, archived: false }], asked.exercise).length === 0) {
          substitutions.push({ asked: asked.exercise, used });
        }
      }),
    );
    return { proposal: toView(doc) as TrainingProposal, substitutions };
  }

  /**
   * Fase 1 → fase 2 de una dieta: el traductor elige los alimentos del catálogo, el código calcula las macros y comprueba
   * los topes duros (déficit, mínimo seguro, proteína). Si se salen, la propuesta no se guarda y el motivo vuelve al
   * entrenador para que reajuste las cantidades.
   */
  async createDiet(
    userId: string,
    design: DietDesign,
  ): Promise<{ proposal: DietProposal; substitutions: FoodSubstitution[] }> {
    const nutrition = await this.targets.forUser(userId, design.goal);
    if ("missing" in nutrition) {
      throw new ProposalError(
        `Faltan datos del usuario para calcular sus topes (${nutrition.missing.join(", ")}). Pídele que los complete en Yo > Mis datos antes de diseñar la dieta.`,
      );
    }

    const catalog = await this.foods.list(userId);
    const byId = new Map(catalog.map((f) => [f.id, f]));
    let translated;
    try {
      translated = await this.dietTranslator.translate(userId, design, catalog);
    } catch (error) {
      const code = error instanceof Error ? error.message : "translator_error";
      throw new ProposalError(
        code === "translator_too_long"
          ? "La dieta es demasiado larga para prepararla de una vez. Propón una con menos comidas o alimentos."
          : "No he podido preparar la dieta ahora mismo.",
      );
    }

    // La traducción solo elige alimentos: comidas, horas y gramos son los del diseño.
    const shapeOk =
      translated.meals.length === design.meals.length &&
      translated.meals.every((m, i) => m.foodIds.length === design.meals[i].foods.length);
    if (!shapeOk) throw new ProposalError("La traducción no respetó las comidas y alimentos del diseño.");

    // Se conserva el orden del diseño para comparar alimentos pedidos y usados; la dieta guardada va ordenada por hora.
    const built = design.meals.map((meal, i) => {
      const items = meal.foods.map((f, j) => {
        const food = byId.get(translated.meals[i].foodIds[j]);
        if (!food) throw new ProposalError("El traductor usó un alimento que no existe en el catálogo.");
        return { asked: f.food, food, grams: f.grams };
      });
      return {
        name: meal.name,
        time: meal.time,
        items,
        macros: sumMacros(items.map((it) => foodMacros(it.food, it.grams))),
      };
    });
    const totals = sumMacros(built.map((m) => m.macros));

    const problem = dietLimitProblem(nutrition.limits, totals);
    if (problem) throw new ProposalError(problem);

    const parsed = dietProposalPayloadSchema.safeParse({
      name: design.name,
      goal: design.goal,
      meals: [...built]
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((m) => ({
          name: m.name,
          time: m.time,
          macros: m.macros,
          items: m.items.map((it) => ({ foodId: it.food.id, foodName: it.food.name, grams: it.grams })),
        })),
      totals,
    });
    if (!parsed.success) {
      this.logger.warn(`Dieta no válida: ${JSON.stringify(parsed.error.issues).slice(0, 500)}`);
      throw new ProposalError("La dieta preparada no es válida.");
    }

    const doc = await this.model.create({ userId, kind: "diet", status: "pending", diet: parsed.data });
    await this.recordLimitations(translated.limitations).catch((e) =>
      this.logger.warn(`No se pudieron guardar las sugerencias: ${e instanceof Error ? e.message : String(e)}`),
    );

    // Alimentos cambiados por otro del catálogo (los parecidos de nombre no cuentan): el entrenador puede decírselo al usuario.
    const substitutions: FoodSubstitution[] = built.flatMap((m) =>
      m.items
        .filter((it) => searchFoods([it.food], it.asked).length === 0)
        .map((it) => ({ asked: it.asked, used: it.food.name })),
    );
    return { proposal: toView(doc) as DietProposal, substitutions };
  }

  /** Cada limitación se agrupa por su código: sube el contador y se guardan unos pocos ejemplos recientes. */
  private async recordLimitations(limitations: Limitation[]): Promise<void> {
    // Los códigos los inventa la IA: con un tope de distintos, no crecen sin límite si un día se desmadra.
    const known = await this.suggestions.countDocuments();
    for (const { code, text } of limitations) {
      if (known >= MAX_SUGGESTION_CODES && !(await this.suggestions.exists({ code }))) continue;
      await this.suggestions.updateOne(
        { code },
        {
          $inc: { count: 1 },
          $push: { examples: { $each: [text], $slice: -MAX_EXAMPLES } },
          $setOnInsert: { status: "open" },
        },
        { upsert: true },
      );
    }
  }

  /** Las propuestas (con su estado actual) de estos ids, solo si son del usuario. */
  async views(userId: string, ids: string[]): Promise<Map<string, CoachProposal>> {
    const valid = ids.filter((id) => isValidObjectId(id));
    if (valid.length === 0) return new Map();
    const docs = await this.model.find({ _id: { $in: valid }, userId });
    return new Map(docs.map((d) => [d.id, toView(d)]));
  }

  /**
   * Reclama la propuesta de forma atómica: solo una petición la pasa de `pending` a `status`. Dos toques seguidos, dos
   * pestañas o un reintento no pueden resolverla dos veces (ni crear dos entrenamientos).
   */
  private async claim(userId: string, id: string, status: "accepted" | "rejected"): Promise<CoachProposalDocument> {
    const doc = isValidObjectId(id)
      ? await this.model.findOneAndUpdate({ _id: id, userId, status: "pending" }, { $set: { status } }, { new: true })
      : null;
    if (doc) return doc;
    if (isValidObjectId(id) && (await this.model.exists({ _id: id, userId }))) {
      throw new ConflictException("Esta propuesta ya se resolvió");
    }
    throw new NotFoundException("Propuesta no encontrada");
  }

  /** El usuario acepta: se crea de verdad el entrenamiento o la dieta (y, si quiere, pasa a ser el actual). */
  async accept(userId: string, id: string, dto: AcceptProposal): Promise<Training | Diet> {
    const doc = await this.claim(userId, id, "accepted");
    return doc.kind === "diet" ? this.acceptDiet(userId, doc, dto) : this.acceptTraining(userId, doc, dto);
  }

  private async acceptDiet(userId: string, doc: CoachProposalDocument, { startDate, setActive }: AcceptProposal): Promise<Diet> {
    const diet = doc.diet!;
    let created: Diet;
    try {
      created = await this.diets.createWithMeals(
        userId,
        { name: diet.name, goal: diet.goal, startDate },
        diet.meals.map((m) => ({ name: m.name, time: m.time, items: m.items.map((i) => ({ foodId: i.foodId, grams: i.grams })) })),
      );
    } catch (error) {
      // No se pudo crear (por ejemplo, un alimento archivado mientras tanto): la propuesta vuelve a estar pendiente.
      await this.model.updateOne({ _id: doc.id, userId }, { $set: { status: "pending" } });
      throw error;
    }
    doc.dietId = created.id;
    await doc.save();
    if (setActive) await this.settings.update(userId, { activeDietId: created.id });
    return created;
  }

  private async acceptTraining(userId: string, doc: CoachProposalDocument, { startDate, setActive }: AcceptProposal): Promise<Training> {
    const training = doc.training!;
    const id = doc.id;
    let created: Training;
    try {
      created = await this.trainings.createWithRoutines(
        userId,
        { name: training.name, startDate, durationWeeks: training.durationWeeks },
        training.routines.map((r) => ({
          name: r.name,
          restSeconds: r.restSeconds,
          slots: r.slots.map(({ exerciseName: _name, ...slot }) => slot),
        })),
      );
    } catch (error) {
      // No se pudo crear (por ejemplo, un ejercicio archivado mientras tanto): la propuesta vuelve a estar pendiente.
      await this.model.updateOne({ _id: id, userId }, { $set: { status: "pending" } });
      throw error;
    }
    doc.trainingId = created.id;
    await doc.save();
    if (setActive) await this.settings.update(userId, { activeTrainingId: created.id });
    return created;
  }

  async reject(userId: string, id: string): Promise<void> {
    await this.claim(userId, id, "rejected");
  }

  /** Borra todas las propuestas del usuario (al borrar su conversación). */
  async clearAll(userId: string): Promise<void> {
    await this.model.deleteMany({ userId });
  }
}
