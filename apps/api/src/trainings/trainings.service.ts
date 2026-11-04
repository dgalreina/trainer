import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  DEFAULT_REST_SECONDS,
  type CreateRoutine,
  type CreateTraining,
  type Routine,
  type Training,
  type UpdateRoutine,
  type UpdateTraining,
} from "@trainer/shared";
import { isValidObjectId, type Model, type Types } from "mongoose";
import { ExercisesService } from "../exercises/exercises.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { type TrainingRoutineDoc, TrainingDoc, type TrainingDocument } from "./training.schema.js";

type RoutineDocument = TrainingDocument["routines"][number];

function toRoutine(doc: RoutineDocument & { id?: string }): Routine {
  return {
    id: String(doc.id),
    name: doc.name,
    slots: doc.slots.map((s) => ({
      exerciseId: s.exerciseId,
      sets: s.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
      linkedToNext: s.linkedToNext,
      restPause: s.restPause,
      notes: s.notes,
    })),
  };
}

function toTraining(doc: TrainingDocument): Training {
  return {
    id: doc.id,
    userId: doc.userId,
    name: doc.name,
    startDate: doc.startDate,
    durationWeeks: doc.durationWeeks,
    // Los entrenamientos anteriores a este campo no lo tienen guardado.
    restSeconds: doc.restSeconds ?? DEFAULT_REST_SECONDS,
    routines: doc.routines.map(toRoutine),
  };
}

@Injectable()
export class TrainingsService {
  constructor(
    @InjectModel(TrainingDoc.name) private readonly model: Model<TrainingDoc>,
    private readonly exercises: ExercisesService,
    private readonly settings: SettingsService,
  ) {}

  /** Los más recientes primero. */
  async list(userId: string): Promise<Training[]> {
    const docs = await this.model.find({ userId }).sort({ startDate: -1 });
    return docs.map(toTraining);
  }

  async get(userId: string, id: string): Promise<Training> {
    return toTraining(await this.findOwn(userId, id));
  }

  async create(userId: string, dto: CreateTraining): Promise<Training> {
    return toTraining(await this.model.create({ userId, ...dto }));
  }

  async update(userId: string, id: string, dto: UpdateTraining): Promise<Training> {
    const doc = await this.findOwn(userId, id);
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.startDate !== undefined) doc.startDate = dto.startDate;
    if (dto.durationWeeks !== undefined) doc.durationWeeks = dto.durationWeeks;
    if (dto.restSeconds !== undefined) doc.restSeconds = dto.restSeconds;
    return toTraining(await doc.save());
  }

  // Borrarlo no toca las sesiones ya registradas; si estaba activo, se desactiva.
  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.findOwn(userId, id);
    await doc.deleteOne();
    await this.settings.clearActiveTraining(userId, id);
  }

  async addRoutine(userId: string, id: string, dto: CreateRoutine): Promise<Training> {
    const doc = await this.findOwn(userId, id);
    await this.exercises.assertVisible(userId, dto.slots.map((s) => s.exerciseId));
    doc.routines.push({ name: dto.name, slots: dto.slots } as RoutineDocument);
    return toTraining(await doc.save());
  }

  async updateRoutine(
    userId: string,
    id: string,
    routineId: string,
    dto: UpdateRoutine,
  ): Promise<Training> {
    const doc = await this.findOwn(userId, id);
    const routine = this.findRoutine(doc, routineId);
    if (dto.slots) {
      await this.exercises.assertVisible(userId, dto.slots.map((s) => s.exerciseId));
      routine.set("slots", dto.slots);
    }
    if (dto.name !== undefined) routine.name = dto.name;
    return toTraining(await doc.save());
  }

  async removeRoutine(userId: string, id: string, routineId: string): Promise<Training> {
    const doc = await this.findOwn(userId, id);
    this.findRoutine(doc, routineId).deleteOne();
    return toTraining(await doc.save());
  }

  // Los de otros usuarios se tratan como inexistentes: no revelar que existen.
  private async findOwn(userId: string, id: string): Promise<TrainingDocument> {
    const doc = isValidObjectId(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!doc) throw new NotFoundException("Entrenamiento no encontrado");
    return doc;
  }

  private findRoutine(doc: TrainingDocument, routineId: string) {
    // Mongoose da a esta lista el método `.id()` de los subdocumentos; el tipo solo declara el array.
    const routines = doc.routines as unknown as Types.DocumentArray<TrainingRoutineDoc>;
    const routine = isValidObjectId(routineId) ? routines.id(routineId) : null;
    if (!routine) throw new NotFoundException("Rutina no encontrada");
    return routine;
  }
}
