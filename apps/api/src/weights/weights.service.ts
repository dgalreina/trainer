import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { CreateWeightEntry, UpdateWeightEntry, WeightEntry } from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { WeightDoc, type WeightDocument } from "./weight.schema.js";

const DEFAULT_DAYS = 60;
const MAX_RESULTS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

function toEntry(doc: WeightDocument): WeightEntry {
  return { id: doc.id, userId: doc.userId, date: doc.date.toISOString(), weightKg: doc.weightKg };
}

@Injectable()
export class WeightsService {
  constructor(@InjectModel(WeightDoc.name) private readonly model: Model<WeightDoc>) {}

  /** De la más antigua a la más reciente. Sin rango, los últimos 60 días. */
  async list(userId: string, from?: Date, to?: Date): Promise<WeightEntry[]> {
    const end = to ?? new Date(Date.now() + DAY_MS);
    const start = from ?? new Date(end.getTime() - DEFAULT_DAYS * DAY_MS);
    const docs = await this.model
      .find({ userId, date: { $gte: start, $lt: end } })
      .sort({ date: 1 })
      .limit(MAX_RESULTS);
    return docs.map(toEntry);
  }

  async latest(userId: string): Promise<WeightEntry | null> {
    const doc = await this.model.findOne({ userId }).sort({ date: -1 });
    return doc ? toEntry(doc) : null;
  }

  async create(userId: string, dto: CreateWeightEntry): Promise<WeightEntry> {
    const doc = await this.model.create({ userId, date: new Date(dto.date), weightKg: dto.weightKg });
    return toEntry(doc);
  }

  async update(userId: string, id: string, dto: UpdateWeightEntry): Promise<WeightEntry> {
    const doc = await this.findOwn(userId, id);
    if (dto.date !== undefined) doc.date = new Date(dto.date);
    if (dto.weightKg !== undefined) doc.weightKg = dto.weightKg;
    return toEntry(await doc.save());
  }

  async remove(userId: string, id: string): Promise<void> {
    await (await this.findOwn(userId, id)).deleteOne();
  }

  // Las de otros usuarios se tratan como inexistentes: no revelar que existen.
  private async findOwn(userId: string, id: string): Promise<WeightDocument> {
    const doc = isValidObjectId(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!doc) throw new NotFoundException("Pesada no encontrada");
    return doc;
  }
}
