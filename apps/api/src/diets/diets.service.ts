import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CreateDiet,
  CreateMeal,
  Diet,
  Meal,
  UpdateDiet,
  UpdateMeal,
} from "@trainer/shared";
import { isValidObjectId, type Model, type Types } from "mongoose";
import { FoodsService } from "../foods/foods.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { type MealDoc, DietDoc, type DietDocument } from "./diet.schema.js";

type MealDocument = DietDocument["meals"][number];

function toMeal(doc: MealDocument & { id?: string }): Meal {
  return {
    id: String(doc.id),
    name: doc.name,
    time: doc.time,
    items: doc.items.map((i) => ({ foodId: i.foodId, grams: i.grams })),
  };
}

function byTime(a: Meal, b: Meal): number {
  return a.time.localeCompare(b.time);
}

function toDiet(doc: DietDocument): Diet {
  return {
    id: doc.id,
    userId: doc.userId,
    name: doc.name,
    goal: doc.goal,
    startDate: doc.startDate,
    // Las comidas salen ordenadas por hora.
    meals: doc.meals.map(toMeal).sort(byTime),
  };
}

@Injectable()
export class DietsService {
  constructor(
    @InjectModel(DietDoc.name) private readonly model: Model<DietDoc>,
    private readonly foods: FoodsService,
    private readonly settings: SettingsService,
  ) {}

  /** Las más recientes primero. */
  async list(userId: string): Promise<Diet[]> {
    const docs = await this.model.find({ userId }).sort({ startDate: -1 });
    return docs.map(toDiet);
  }

  async get(userId: string, id: string): Promise<Diet> {
    return toDiet(await this.findOwn(userId, id));
  }

  async create(userId: string, dto: CreateDiet): Promise<Diet> {
    return toDiet(await this.model.create({ userId, ...dto }));
  }

  async update(userId: string, id: string, dto: UpdateDiet): Promise<Diet> {
    const doc = await this.findOwn(userId, id);
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.goal !== undefined) doc.goal = dto.goal;
    if (dto.startDate !== undefined) doc.startDate = dto.startDate;
    return toDiet(await doc.save());
  }

  // Si estaba activa, se desactiva.
  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.findOwn(userId, id);
    await doc.deleteOne();
    await this.settings.clearActiveDiet(userId, id);
  }

  async addMeal(userId: string, id: string, dto: CreateMeal): Promise<Diet> {
    const doc = await this.findOwn(userId, id);
    await this.foods.assertVisible(userId, dto.items.map((i) => i.foodId));
    doc.meals.push({ name: dto.name, time: dto.time, items: dto.items } as MealDocument);
    return toDiet(await doc.save());
  }

  async updateMeal(userId: string, id: string, mealId: string, dto: UpdateMeal): Promise<Diet> {
    const doc = await this.findOwn(userId, id);
    const meal = this.findMeal(doc, mealId);
    if (dto.items) {
      await this.foods.assertVisible(userId, dto.items.map((i) => i.foodId));
      meal.set("items", dto.items);
    }
    if (dto.name !== undefined) meal.name = dto.name;
    if (dto.time !== undefined) meal.time = dto.time;
    return toDiet(await doc.save());
  }

  async removeMeal(userId: string, id: string, mealId: string): Promise<Diet> {
    const doc = await this.findOwn(userId, id);
    this.findMeal(doc, mealId).deleteOne();
    return toDiet(await doc.save());
  }

  // Las de otros usuarios se tratan como inexistentes: no revelar que existen.
  private async findOwn(userId: string, id: string): Promise<DietDocument> {
    const doc = isValidObjectId(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!doc) throw new NotFoundException("Dieta no encontrada");
    return doc;
  }

  private findMeal(doc: DietDocument, mealId: string) {
    // Mongoose da a esta lista el método `.id()` de los subdocumentos; el tipo solo declara el array.
    const meals = doc.meals as unknown as Types.DocumentArray<MealDoc>;
    const meal = isValidObjectId(mealId) ? meals.id(mealId) : null;
    if (!meal) throw new NotFoundException("Comida no encontrada");
    return meal;
  }
}
