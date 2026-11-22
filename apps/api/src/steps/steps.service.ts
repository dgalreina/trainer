import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { CreateStepEntry, StepEntry, UpdateStepEntry } from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { StepDoc, type StepDocument } from "./step.schema.js";

const DEFAULT_DAYS = 60;
const MAX_RESULTS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_KEY = 11000;

function toEntry(doc: StepDocument): StepEntry {
  return { id: doc.id, userId: doc.userId, date: doc.date.toISOString(), day: doc.day, steps: doc.steps };
}

function clash(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === DUPLICATE_KEY;
}

@Injectable()
export class StepsService {
  constructor(@InjectModel(StepDoc.name) private readonly model: Model<StepDoc>) {}

  /** De la más antigua a la más reciente. Sin rango, los últimos 60 días. */
  async list(userId: string, from?: Date, to?: Date): Promise<StepEntry[]> {
    const end = to ?? new Date(Date.now() + DAY_MS);
    const start = from ?? new Date(end.getTime() - DEFAULT_DAYS * DAY_MS);
    const docs = await this.model
      .find({ userId, date: { $gte: start, $lt: end } })
      .sort({ date: 1 })
      .limit(MAX_RESULTS);
    return docs.map(toEntry);
  }

  async create(userId: string, dto: CreateStepEntry): Promise<StepEntry> {
    try {
      const doc = await this.model.create({ userId, date: new Date(dto.date), day: dto.day, steps: dto.steps });
      return toEntry(doc);
    } catch (error) {
      if (clash(error)) throw new ConflictException("Ese día ya tiene pasos: edítalos en vez de añadir otros");
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateStepEntry): Promise<StepEntry> {
    const doc = await this.findOwn(userId, id);
    if (dto.date !== undefined) doc.date = new Date(dto.date);
    if (dto.day !== undefined) doc.day = dto.day;
    if (dto.steps !== undefined) doc.steps = dto.steps;
    try {
      return toEntry(await doc.save());
    } catch (error) {
      if (clash(error)) throw new ConflictException("Ese día ya tiene pasos");
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    await (await this.findOwn(userId, id)).deleteOne();
  }

  // Los de otros usuarios se tratan como inexistentes: no revelar que existen.
  private async findOwn(userId: string, id: string): Promise<StepDocument> {
    const doc = isValidObjectId(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!doc) throw new NotFoundException("Registro de pasos no encontrado");
    return doc;
  }
}
