import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { CreateWorkoutSession, WorkoutSession } from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { ExercisesService } from "../exercises/exercises.service.js";
import { SessionDoc, type SessionDocument } from "./session.schema.js";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function toSession(doc: SessionDocument): WorkoutSession {
  return {
    id: doc.id,
    userId: doc.userId,
    trainingId: doc.trainingId,
    routineId: doc.routineId,
    date: doc.date.toISOString(),
    durationSeconds: doc.durationSeconds,
    entries: doc.entries.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg, rpe: s.rpe })),
      linkedToNext: e.linkedToNext,
      restPause: e.restPause,
      notes: e.notes,
    })),
    notes: doc.notes,
  };
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(SessionDoc.name) private readonly model: Model<SessionDoc>,
    private readonly exercises: ExercisesService,
  ) {}

  /** Las más recientes primero. */
  async list(userId: string, limit?: number): Promise<WorkoutSession[]> {
    const take = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const docs = await this.model.find({ userId }).sort({ date: -1 }).limit(take);
    return docs.map(toSession);
  }

  async get(userId: string, id: string): Promise<WorkoutSession> {
    return toSession(await this.findOwn(userId, id));
  }

  async create(userId: string, dto: CreateWorkoutSession): Promise<WorkoutSession> {
    await this.exercises.assertVisible(userId, dto.entries.map((e) => e.exerciseId));
    const doc = await this.model.create({
      userId,
      trainingId: dto.trainingId,
      routineId: dto.routineId,
      date: new Date(dto.date),
      durationSeconds: dto.durationSeconds,
      entries: dto.entries,
      notes: dto.notes,
    });
    return toSession(doc);
  }

  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.findOwn(userId, id);
    await doc.deleteOne();
  }

  // Las de otros usuarios se tratan como inexistentes: no revelar que existen.
  private async findOwn(userId: string, id: string): Promise<SessionDocument> {
    const doc = isValidObjectId(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!doc) throw new NotFoundException("Sesión no encontrada");
    return doc;
  }
}
