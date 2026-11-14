import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { COACH_MAX_STORED_MESSAGES, type CoachMessage, type CoachStoredMessage } from "@trainer/shared";
import type { Model } from "mongoose";
import { CoachMessageDoc, type CoachMessageDocument } from "./coach-message.schema.js";

const toStored = (doc: CoachMessageDocument): CoachStoredMessage => ({
  id: doc.id,
  role: doc.role,
  content: doc.content,
  createdAt: doc.createdAt.toISOString(),
});

/** La conversación del usuario con el entrenador, guardada en Mongo. */
@Injectable()
export class CoachConversationService {
  constructor(@InjectModel(CoachMessageDoc.name) private readonly model: Model<CoachMessageDoc>) {}

  /** Los últimos mensajes, del más antiguo al más reciente. */
  async list(userId: string, limit = COACH_MAX_STORED_MESSAGES): Promise<CoachStoredMessage[]> {
    const docs = await this.model.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    return docs.reverse().map(toStored);
  }

  /** Lo que se le pasa a Claude: los mensajes recientes (luego `trimHistory` los recorta por tokens). */
  async history(userId: string, limit = COACH_MAX_STORED_MESSAGES): Promise<CoachMessage[]> {
    const docs = await this.model.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    return docs.reverse().map((d) => ({
      role: d.role,
      // Las consultas con herramientas no se guardan: sin esta nota, Claude veía cifras sin consulta detrás y se
      // «corregía» diciendo que las había inventado. La nota solo viaja a Claude; el usuario no la ve.
      content: d.usedTools ? `${d.content}

[Nota del sistema: esta respuesta se basó en datos reales consultados con herramientas en ese momento.]` : d.content,
    }));
  }

  /** Guarda una vuelta completa: lo que dijo el usuario y lo que contestó el entrenador. */
  async appendExchange(userId: string, userText: string, reply: string, usedTools = false): Promise<void> {
    const now = Date.now();
    await this.model.insertMany([
      { userId, role: "user", content: userText, createdAt: new Date(now) },
      { userId, role: "assistant", content: reply, usedTools, createdAt: new Date(now + 1) },
    ]);
    await this.prune(userId);
  }

  /** Borra toda la conversación del usuario. */
  async clear(userId: string): Promise<void> {
    await this.model.deleteMany({ userId });
  }

  // Se conservan los últimos `COACH_MAX_STORED_MESSAGES`: se busca el primero que sobra y se borra desde ahí hacia atrás.
  private async prune(userId: string): Promise<void> {
    const [extra] = await this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(COACH_MAX_STORED_MESSAGES)
      .limit(1);
    if (extra) await this.model.deleteMany({ userId, createdAt: { $lte: extra.createdAt } });
  }
}
