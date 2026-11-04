import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  type CreateFood,
  type Food,
  type UpdateFood,
  foodNameKey,
} from "@trainer/shared";
import { isValidObjectId, type Model } from "mongoose";
import { FoodDoc, type FoodDocument } from "./food.schema.js";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toFood(doc: FoodDocument): Food {
  return {
    id: doc.id,
    name: doc.name,
    category: doc.category,
    kcal: doc.kcal,
    protein: doc.protein,
    carbs: doc.carbs,
    fat: doc.fat,
    portions: doc.portions.map((p) => ({ name: p.name, grams: p.grams })),
    ownerId: doc.ownerId,
    archived: doc.archived,
  };
}

@Injectable()
export class FoodsService {
  constructor(
    @InjectModel(FoodDoc.name) private readonly model: Model<FoodDoc>,
  ) {}

  /** Catálogo base + alimentos propios, sin los archivados. Con `q`, búsqueda por nombre. */
  async list(userId: string, q?: string): Promise<Food[]> {
    const filter: Record<string, unknown> = {
      archived: false,
      ownerId: { $in: [null, userId] },
    };
    const key = q ? foodNameKey(q) : "";
    if (key) filter.nameKey = { $regex: escapeRegex(key) };

    const docs = await this.model
      .find(filter)
      .sort({ nameKey: 1 })
      .limit(key ? 30 : 0);
    return docs.map(toFood);
  }

  /**
   * Crea un alimento propio. Si ya hay uno visible con ese nombre es un conflicto: a diferencia
   * de un ejercicio, dos alimentos con el mismo nombre pueden tener macros distintas, y
   * devolver el existente en silencio daría cifras que el usuario no ha escrito.
   */
  async create(userId: string, dto: CreateFood): Promise<Food> {
    const nameKey = foodNameKey(dto.name);
    const clash = await this.model.exists({
      nameKey,
      ownerId: { $in: [null, userId] },
    });
    if (clash) throw new ConflictException("Ya existe un alimento con ese nombre");

    try {
      const created = await this.model.create({
        name: dto.name.trim(),
        nameKey,
        category: dto.category,
        kcal: dto.kcal,
        protein: dto.protein,
        carbs: dto.carbs,
        fat: dto.fat,
        portions: dto.portions ?? [],
        ownerId: userId,
      });
      return toFood(created);
    } catch (err) {
      // Carrera con otra petición idéntica: el índice único lo impide.
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException("Ya existe un alimento con ese nombre");
      }
      throw err;
    }
  }

  async update(userId: string, id: string, dto: UpdateFood): Promise<Food> {
    const doc = await this.findEditable(userId, id);
    if (dto.name !== undefined) {
      const nameKey = foodNameKey(dto.name);
      if (nameKey !== doc.nameKey) {
        const clash = await this.model.exists({
          nameKey,
          ownerId: { $in: [null, userId] },
          _id: { $ne: doc._id },
        });
        if (clash) throw new ConflictException("Ya existe un alimento con ese nombre");
      }
      doc.name = dto.name.trim();
      doc.nameKey = nameKey;
    }
    if (dto.category !== undefined) doc.category = dto.category;
    if (dto.kcal !== undefined) doc.kcal = dto.kcal;
    if (dto.protein !== undefined) doc.protein = dto.protein;
    if (dto.carbs !== undefined) doc.carbs = dto.carbs;
    if (dto.fat !== undefined) doc.fat = dto.fat;
    if (dto.portions !== undefined) doc.portions = dto.portions;
    if (dto.archived !== undefined) doc.archived = dto.archived;
    // Los macros de 100 g no pueden pasarse tras una edición parcial.
    if (doc.protein + doc.carbs + doc.fat > 101) {
      throw new BadRequestException(
        "Proteína, hidratos y grasa no pueden sumar más de 100 g por 100 g",
      );
    }
    return toFood(await doc.save());
  }

  /** No se borra: se archiva para que las comidas ya guardadas no se rompan. */
  async archive(userId: string, id: string): Promise<void> {
    const doc = await this.findEditable(userId, id);
    doc.archived = true;
    await doc.save();
  }

  /**
   * Devuelve los alimentos pedidos, comprobando que existen y son visibles para el usuario
   * (catálogo base o suyos; los archivados valen). Lanza 400 si alguno no.
   */
  async findVisible(userId: string, ids: string[]): Promise<Food[]> {
    const unique = [...new Set(ids)];
    if (unique.some((id) => !isValidObjectId(id))) {
      throw new BadRequestException("Identificador de alimento no válido");
    }
    const docs = await this.model.find({ _id: { $in: unique }, ownerId: { $in: [null, userId] } });
    if (docs.length !== unique.length) throw new BadRequestException("Algún alimento no existe");
    return docs.map(toFood);
  }

  /**
   * Comprueba que todos los alimentos existen y son visibles para el usuario (catálogo base o
   * suyos). Los archivados valen: las comidas ya guardadas pueden seguir apuntando a ellos.
   */
  async assertVisible(userId: string, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.some((id) => !isValidObjectId(id))) {
      throw new BadRequestException("Identificador de alimento no válido");
    }
    const found = await this.model.countDocuments({
      _id: { $in: unique },
      ownerId: { $in: [null, userId] },
    });
    if (found !== unique.length) {
      throw new BadRequestException("Algún alimento no existe");
    }
  }

  private async findEditable(userId: string, id: string): Promise<FoodDocument> {
    const doc = isValidObjectId(id) ? await this.model.findById(id) : null;
    // Los de otros usuarios se tratan como inexistentes: no revelar que existen.
    if (!doc || (doc.ownerId !== null && doc.ownerId !== userId)) {
      throw new NotFoundException("Alimento no encontrado");
    }
    if (doc.ownerId === null) {
      throw new ForbiddenException("Es del catálogo base y no se puede modificar");
    }
    return doc;
  }
}
