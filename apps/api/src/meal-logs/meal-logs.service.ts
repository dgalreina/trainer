import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  type CreateMealLog,
  type MealItem,
  type MealLog,
  type UpdateMealLog,
  foodMacros,
} from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { FoodsService } from "../foods/foods.service.js";
import { MealLogDoc, type MealLogDocument } from "./meal-log.schema.js";

const DEFAULT_DAYS = 7;
const MAX_RESULTS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

function toLog(doc: MealLogDocument): MealLog {
  return {
    id: doc.id,
    userId: doc.userId,
    date: doc.date.toISOString(),
    name: doc.name,
    items: doc.items.map((i) => ({
      foodId: i.foodId,
      grams: i.grams,
      kcal: i.kcal,
      protein: i.protein,
      carbs: i.carbs,
      fat: i.fat,
    })),
    ...(doc.dietMealId ? { dietMealId: doc.dietMealId } : {}),
    ...(doc.skipped ? { skipped: true } : {}),
  };
}

@Injectable()
export class MealLogsService {
  constructor(
    @InjectModel(MealLogDoc.name) private readonly model: Model<MealLogDoc>,
    private readonly foods: FoodsService,
  ) {}

  /** De la más antigua a la más reciente. Sin rango, los últimos 7 días. */
  async list(userId: string, from?: Date, to?: Date): Promise<MealLog[]> {
    const end = to ?? new Date(Date.now() + DAY_MS);
    const start = from ?? new Date(end.getTime() - DEFAULT_DAYS * DAY_MS);
    const docs = await this.model
      .find({ userId, date: { $gte: start, $lt: end } })
      .sort({ date: 1 })
      .limit(MAX_RESULTS);
    return docs.map(toLog);
  }

  async create(userId: string, dto: CreateMealLog): Promise<MealLog> {
    // Una comida descartada no guarda alimentos: solo marca que ese día no se hizo.
    const items = dto.skipped ? [] : await this.snapshot(userId, dto.items);
    const doc = await this.model.create({
      userId,
      date: new Date(dto.date),
      name: dto.name,
      items,
      ...(dto.dietMealId ? { dietMealId: dto.dietMealId } : {}),
      ...(dto.skipped ? { skipped: true } : {}),
    });
    return toLog(doc);
  }

  async update(userId: string, id: string, dto: UpdateMealLog): Promise<MealLog> {
    const doc = await this.findOwn(userId, id);
    if (dto.date !== undefined) doc.date = new Date(dto.date);
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.skipped) {
      doc.skipped = true;
      doc.set("items", []);
    }
    // Solo si cambian los alimentos se recalculan las macros; mover la hora no toca nada más.
    if (dto.items !== undefined && !dto.skipped) doc.set("items", await this.snapshot(userId, dto.items));
    return toLog(await doc.save());
  }

  async remove(userId: string, id: string): Promise<void> {
    await (await this.findOwn(userId, id)).deleteOne();
  }

  /** Calcula las macros de cada cantidad con los valores del catálogo en este momento. */
  private async snapshot(userId: string, items: MealItem[]) {
    const found = await this.foods.findVisible(userId, items.map((i) => i.foodId));
    const byId = new Map(found.map((f) => [f.id, f]));
    return items.map((item) => {
      const food = byId.get(item.foodId);
      // `findVisible` ya ha comprobado que existen todos.
      return { foodId: item.foodId, grams: item.grams, ...foodMacros(food!, item.grams) };
    });
  }

  // Las de otros usuarios se tratan como inexistentes: no revelar que existen.
  private async findOwn(userId: string, id: string): Promise<MealLogDocument> {
    const doc = isValidObjectId(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!doc) throw new NotFoundException("Comida no encontrada");
    return doc;
  }
}
