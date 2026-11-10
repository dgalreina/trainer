import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  exerciseNameKey,
  type CreateRoutine,
  type Technique,
  type Training,
  type TrainingTemplate,
  type UseTemplate,
} from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { ExerciseDoc } from "../exercises/exercise.schema.js";
import { TrainingsService } from "../trainings/trainings.service.js";
import { TrainingTemplateDoc, type TrainingTemplateDocument } from "./training-template.schema.js";

function toTemplate(doc: TrainingTemplateDocument): TrainingTemplate {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    durationWeeks: doc.durationWeeks,
    routines: doc.routines.map((r) => ({
      name: r.name,
      restSeconds: r.restSeconds,
      slots: r.slots.map((s) => ({
        exercise: s.exercise,
        sets: s.sets.map((set) => ({ reps: set.reps })),
        technique: s.technique as Technique | undefined,
        restSeconds: s.restSeconds,
        notes: s.notes,
      })),
    })),
  };
}

@Injectable()
export class TrainingTemplatesService {
  constructor(
    @InjectModel(TrainingTemplateDoc.name) private readonly model: Model<TrainingTemplateDoc>,
    @InjectModel(ExerciseDoc.name) private readonly exercises: Model<ExerciseDoc>,
    private readonly trainings: TrainingsService,
  ) {}

  async list(): Promise<TrainingTemplate[]> {
    const docs = await this.model.find().sort({ name: 1 });
    return docs.map(toTemplate);
  }

  /** Copia la plantilla a los entrenamientos del usuario: ejercicios del catálogo base, sin pesos, desde `startDate`. */
  async use(userId: string, id: string, { startDate }: UseTemplate): Promise<Training> {
    const doc = isValidObjectId(id) ? await this.model.findById(id) : null;
    if (!doc) throw new NotFoundException("Plantilla no encontrada");
    const template = toTemplate(doc);

    const keys = [...new Set(template.routines.flatMap((r) => r.slots.map((s) => exerciseNameKey(s.exercise))))];
    const found = await this.exercises.find({ ownerId: null, nameKey: { $in: keys } });
    const idByKey = new Map(found.map((e) => [e.nameKey, String(e.id)]));
    const missing = keys.filter((key) => !idByKey.has(key));
    if (missing.length > 0) {
      throw new UnprocessableEntityException(`Faltan ejercicios en el catálogo: ${missing.join(", ")}`);
    }

    const routines: CreateRoutine[] = template.routines.map((r) => ({
      name: r.name,
      restSeconds: r.restSeconds,
      slots: r.slots.map((s) => ({
        exerciseId: idByKey.get(exerciseNameKey(s.exercise)) as string,
        sets: s.sets,
        technique: s.technique,
        restSeconds: s.restSeconds,
        notes: s.notes,
      })),
    }));
    return this.trainings.createWithRoutines(
      userId,
      { name: template.name, startDate, durationWeeks: template.durationWeeks },
      routines,
    );
  }
}
