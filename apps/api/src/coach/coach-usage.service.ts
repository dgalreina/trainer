import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { CoachUsageDoc } from "./coach-usage.schema.js";
import { PRICING_USD_PER_MTOK, USD_TO_EUR } from "./plans.js";

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** "AAAA-MM" (UTC) del instante dado. */
export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** El mes "AAAA-MM" como rango [inicio, fin) en UTC. */
function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

/** Coste estimado en euros de unos tokens, con la tabla de precios de `plans.ts`. */
export function estimateCostEur(t: Omit<UsageTotals, "calls">): number {
  const usd =
    (t.inputTokens * PRICING_USD_PER_MTOK.input +
      t.outputTokens * PRICING_USD_PER_MTOK.output +
      t.cacheReadTokens * PRICING_USD_PER_MTOK.cacheRead +
      t.cacheWriteTokens * PRICING_USD_PER_MTOK.cacheWrite) /
    1_000_000;
  return Math.round(usd * USD_TO_EUR * 10_000) / 10_000;
}

@Injectable()
export class CoachUsageService {
  constructor(@InjectModel(CoachUsageDoc.name) private readonly model: Model<CoachUsageDoc>) {}

  /** Guarda una llamada con sus tokens. */
  async record(userId: string, model: string, usage: Omit<UsageTotals, "calls">, stopReason: string | null) {
    await this.model.create({ userId, model, ...usage, stopReason });
  }

  /** Lo gastado por el usuario en un mes ("AAAA-MM"; por defecto, el actual). */
  async month(userId: string, month = monthKey(new Date())): Promise<UsageTotals> {
    const { from, to } = monthRange(month);
    const [row] = await this.model.aggregate<UsageTotals>([
      { $match: { userId, createdAt: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: null,
          calls: { $sum: 1 },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          cacheReadTokens: { $sum: "$cacheReadTokens" },
          cacheWriteTokens: { $sum: "$cacheWriteTokens" },
        },
      },
    ]);
    return {
      calls: row?.calls ?? 0,
      inputTokens: row?.inputTokens ?? 0,
      outputTokens: row?.outputTokens ?? 0,
      cacheReadTokens: row?.cacheReadTokens ?? 0,
      cacheWriteTokens: row?.cacheWriteTokens ?? 0,
    };
  }
}
