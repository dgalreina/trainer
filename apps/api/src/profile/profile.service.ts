import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { EMPTY_PROFILE, type Profile, type UpdateProfile } from "@trainer/shared";
import type { Model } from "mongoose";
import { ProfileDoc } from "./profile.schema.js";

@Injectable()
export class ProfileService {
  constructor(@InjectModel(ProfileDoc.name) private readonly model: Model<ProfileDoc>) {}

  /** El perfil completo; con `null` donde no hay dato (también si nunca se ha guardado nada). */
  async get(userId: string): Promise<Profile> {
    const doc = await this.model.findOne({ userId });
    if (!doc) return { ...EMPTY_PROFILE };
    return {
      name: doc.name ?? null,
      birthDate: doc.birthDate ?? null,
      sex: doc.sex ?? null,
      heightCm: doc.heightCm ?? null,
      activityLevel: doc.activityLevel ?? null,
      goal: doc.goal ?? null,
      notes: doc.notes ?? null,
    };
  }

  /** Solo cambia lo que llega; `null` borra un dato. */
  async update(userId: string, dto: UpdateProfile): Promise<Profile> {
    await this.model.updateOne({ userId }, { $set: dto }, { upsert: true });
    return this.get(userId);
  }
}
