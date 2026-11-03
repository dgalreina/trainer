import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { CreateRoutine, Routine, UpdateRoutine } from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { ExercisesService } from "../exercises/exercises.service.js";
import { RoutineDoc, type RoutineDocument } from "./routine.schema.js";

function toRoutine(doc: RoutineDocument): Routine {
  return {
    id: doc.id,
    userId: doc.userId,
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

@Injectable()
export class RoutinesService {
  constructor(
    @InjectModel(RoutineDoc.name) private readonly model: Model<RoutineDoc>,
    private readonly exercises: ExercisesService,
  ) {}

  async list(userId: string): Promise<Routine[]> {
    const docs = await this.model.find({ userId }).sort({ name: 1 });
    return docs.map(toRoutine);
  }

  async get(userId: string, id: string): Promise<Routine> {
    return toRoutine(await this.findOwn(userId, id));
  }

  async create(userId: string, dto: CreateRoutine): Promise<Routine> {
    // El esquema de shared ya rellena los valores por defecto de cada slot.
    const slots = dto.slots;
    await this.exercises.assertVisible(userId, slots.map((s) => s.exerciseId));
    return toRoutine(await this.model.create({ userId, name: dto.name, slots }));
  }

  async update(userId: string, id: string, dto: UpdateRoutine): Promise<Routine> {
    const doc = await this.findOwn(userId, id);
    if (dto.slots) {
      await this.exercises.assertVisible(userId, dto.slots.map((s) => s.exerciseId));
      doc.set("slots", dto.slots);
    }
    if (dto.name !== undefined) doc.name = dto.name;
    return toRoutine(await doc.save());
  }

  // Una rutina es solo una plantilla: borrarla no toca las sesiones ya registradas.
  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.findOwn(userId, id);
    await doc.deleteOne();
  }

  // Las de otros usuarios se tratan como inexistentes: no revelar que existen.
  private async findOwn(userId: string, id: string): Promise<RoutineDocument> {
    const doc = isValidObjectId(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!doc) throw new NotFoundException("Rutina no encontrada");
    return doc;
  }
}
