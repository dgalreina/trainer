import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, type Model } from "mongoose";
import { CoachJobDoc, type CoachJobDocument } from "./coach-job.schema.js";

/** Un mensaje que lleva más de esto «en marcha» se da por perdido (por ejemplo, si se reinició el servidor a mitad). */
export const JOB_STALE_MS = 5 * 60 * 1000;

/** Los mensajes al entrenador que se trabajan en segundo plano (ver `CoachJob` en `@trainer/shared`). */
@Injectable()
export class CoachJobsService {
  constructor(@InjectModel(CoachJobDoc.name) private readonly model: Model<CoachJobDoc>) {}

  create(userId: string): Promise<CoachJobDocument> {
    return this.model.create({ userId, status: "running" });
  }

  /** Da por perdidos los mensajes que llevan demasiado «en marcha» (si no, el índice único bloquearía al usuario). */
  async expireStale(userId: string): Promise<void> {
    await this.model.updateMany(
      { userId, status: "running", createdAt: { $lte: new Date(Date.now() - JOB_STALE_MS) } },
      { $set: { status: "error", errorMessage: "No he podido terminar la consulta. Inténtalo de nuevo." } },
    );
  }

  /** Un mensaje del usuario que todavía se está contestando (y no está perdido). */
  findRunning(userId: string): Promise<CoachJobDocument | null> {
    return this.model.findOne({ userId, status: "running", createdAt: { $gt: new Date(Date.now() - JOB_STALE_MS) } });
  }

  async get(userId: string, id: string): Promise<CoachJobDocument | null> {
    if (!isValidObjectId(id)) return null;
    const job = await this.model.findOne({ _id: id, userId });
    if (job && job.status === "running" && Date.now() - job.createdAt.getTime() > JOB_STALE_MS) {
      job.status = "error";
      job.errorMessage = "No he podido terminar la consulta. Inténtalo de nuevo.";
      await job.save();
    }
    return job;
  }

  async complete(id: string, reply: string, proposalId: string | null): Promise<void> {
    // Solo si sigue en marcha: uno que ya se dio por perdido no se «resucita». Se reintenta una vez por si Mongo parpadea.
    const update = () => this.model.updateOne({ _id: id, status: "running" }, { $set: { status: "done", reply, proposalId } });
    await update().catch(update);
  }

  async fail(id: string, message: string, code?: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, status: "running" },
      { $set: { status: "error", errorMessage: message, errorCode: code ?? null } },
    );
  }
}
