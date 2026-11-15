import type Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";
import { type Exercise, type Limitation, type TrainingDesign, limitationSchema } from "@trainer/shared";
import { z } from "zod";
import { anthropic, MODEL } from "../anthropic.js";
import { CoachUsageService } from "../coach-usage.service.js";
import { TRANSLATOR_PROMPT, catalogPrompt } from "../prompts/translator.js";

/** Tope de tokens de la traducción: un entrenamiento de 5-7 días con todas sus series es largo. */
const TRANSLATOR_MAX_TOKENS = 8000;

const translatedSchema = z.object({
  name: z.string(),
  durationWeeks: z.number(),
  routines: z.array(z.unknown()),
  limitations: z.array(limitationSchema).default([]),
});
export type Translated = {
  name: string;
  durationWeeks: number;
  routines: unknown[];
  limitations: Limitation[];
};

const EMIT_TOOL: Anthropic.Tool = {
  name: "emit_training",
  description: "Entrega el entrenamiento ya traducido al formato de la app.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      durationWeeks: { type: "integer", minimum: 1, maximum: 104 },
      routines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nombre de la rutina; vacío si no tiene" },
            restSeconds: { type: "integer", enum: [0, 60, 90, 120, 180] },
            slots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  exerciseId: { type: "string", description: "Id del catálogo" },
                  sets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { reps: { type: "integer", minimum: 0 }, weightKg: { type: "number", minimum: 0 } },
                      additionalProperties: false,
                    },
                  },
                  technique: { type: "string", enum: ["ss", "rp", "desc"] },
                  restSeconds: { type: "integer", minimum: 0, maximum: 600 },
                  notes: { type: "string", maxLength: 500 },
                },
                required: ["exerciseId", "sets"],
                additionalProperties: false,
              },
            },
          },
          required: ["name", "restSeconds", "slots"],
          additionalProperties: false,
        },
      },
      limitations: {
        type: "array",
        items: {
          type: "object",
          properties: { code: { type: "string" }, text: { type: "string" } },
          required: ["code", "text"],
          additionalProperties: false,
        },
      },
    },
    required: ["name", "durationWeeks", "routines", "limitations"],
    additionalProperties: false,
  },
};

/** Fase 2: el diseño libre del entrenador → el formato de la app, con una llamada a Claude. */
@Injectable()
export class TrainingTranslator {
  private readonly logger = new Logger(TrainingTranslator.name);

  constructor(private readonly usage: CoachUsageService) {}

  async translate(userId: string, design: TrainingDesign, catalog: Exercise[]): Promise<Translated> {
    const lines = catalog.map((e) => `${e.id} | ${e.name} | ${e.category}`);
    let response: Anthropic.Message;
    try {
      response = await anthropic().messages.create({
        model: MODEL,
        max_tokens: TRANSLATOR_MAX_TOKENS,
        thinking: { type: "between_tools" },
        output_config: { effort: "low" },
        system: [
          { type: "text", text: TRANSLATOR_PROMPT },
          // El catálogo es estable entre llamadas: se puede cachear.
          { type: "text", text: catalogPrompt(lines), cache_control: { type: "ephemeral" } },
        ],
        tools: [EMIT_TOOL],
        messages: [{ role: "user", content: `Diseño del entrenador:\n${JSON.stringify(design)}` }],
      });
    } catch (error) {
      this.logger.error(`Traducción fallida: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error("translator_unavailable");
    }

    // Control de coste: la traducción es otra llamada y cuenta contra el tope mensual del usuario.
    await this.usage.record(
      userId,
      MODEL,
      {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
      response.stop_reason,
    );

    const call = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "emit_training",
    );
    if (!call) throw new Error(response.stop_reason === "max_tokens" ? "translator_too_long" : "translator_no_output");
    const parsed = translatedSchema.safeParse(call.input);
    if (!parsed.success) throw new Error("translator_bad_output");
    return parsed.data as Translated;
  }
}
