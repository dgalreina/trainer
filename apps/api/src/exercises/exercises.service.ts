import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  type CreateExercise,
  type Exercise,
  type UpdateExercise,
  exerciseNameKey,
} from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { ExerciseDoc, type ExerciseDocument } from "./exercise.schema.js";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toExercise(doc: ExerciseDocument): Exercise {
  return {
    id: doc.id,
    name: doc.name,
    category: doc.category,
    ownerId: doc.ownerId,
    archived: doc.archived,
  };
}

@Injectable()
export class ExercisesService {
  constructor(
    @InjectModel(ExerciseDoc.name) private readonly model: Model<ExerciseDoc>,
  ) {}

  /** Catálogo base + ejercicios propios, sin los archivados. Con `q`, autocompletado. */
  async list(userId: string, q?: string): Promise<Exercise[]> {
    const filter: Record<string, unknown> = {
      archived: false,
      ownerId: { $in: [null, userId] },
    };
    const key = q ? exerciseNameKey(q) : "";
    if (key) filter.nameKey = { $regex: escapeRegex(key) };

    const docs = await this.model
      .find(filter)
      .sort({ nameKey: 1 })
      .limit(key ? 10 : 0);
    return docs.map(toExercise);
  }

  /** Si ya existe uno visible con ese nombre, lo devuelve en vez de duplicarlo. */
  async findOrCreate(userId: string, dto: CreateExercise): Promise<Exercise> {
    const nameKey = exerciseNameKey(dto.name);
    const visible = { nameKey, ownerId: { $in: [null, userId] } };

    const existing = await this.model.findOne(visible);
    if (existing) {
      // Si el propio usuario lo había archivado, vuelve a estar disponible.
      if (existing.archived && existing.ownerId === userId) {
        existing.archived = false;
        await existing.save();
      }
      return toExercise(existing);
    }

    try {
      const created = await this.model.create({
        name: dto.name.trim(),
        nameKey,
        category: dto.category,
        ownerId: userId,
      });
      return toExercise(created);
    } catch (err) {
      // Carrera con otra petición idéntica: el índice único lo impide.
      if ((err as { code?: number }).code === 11000) {
        const winner = await this.model.findOne(visible);
        if (winner) return toExercise(winner);
      }
      throw err;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateExercise,
  ): Promise<Exercise> {
    const doc = await this.findEditable(userId, id);
    if (dto.name !== undefined) {
      doc.name = dto.name.trim();
      doc.nameKey = exerciseNameKey(dto.name);
    }
    if (dto.category !== undefined) doc.category = dto.category;
    if (dto.archived !== undefined) doc.archived = dto.archived;
    return toExercise(await doc.save());
  }

  /** No se borra: se archiva para que el historial de sesiones no se rompa. */
  async archive(userId: string, id: string): Promise<void> {
    const doc = await this.findEditable(userId, id);
    doc.archived = true;
    await doc.save();
  }

  private async findEditable(
    userId: string,
    id: string,
  ): Promise<ExerciseDocument> {
    const doc = isValidObjectId(id) ? await this.model.findById(id) : null;
    // Los de otros usuarios se tratan como inexistentes: no revelar que existen.
    if (!doc || (doc.ownerId !== null && doc.ownerId !== userId)) {
      throw new NotFoundException("Ejercicio no encontrado");
    }
    if (doc.ownerId === null) {
      throw new ForbiddenException(
        "Es del catálogo base y no se puede modificar",
      );
    }
    return doc;
  }
}
