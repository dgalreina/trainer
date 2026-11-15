import type Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";
import { type DietDesign, type Food, type Limitation, limitationSchema } from "@trainer/shared";
import { z } from "zod";
import { anthropic, MODEL } from "../anthropic.js";
import { CoachUsageService } from "../coach-usage.service.js";
import { DIET_TRANSLATOR_PROMPT, foodCatalogPrompt } from "../prompts/translator.js";

const TRANSLATOR_MAX_TOKENS = 4000;

const translatedSchema = z.object({
  meals: z.array(z.object({ foodIds: z.array(z.string()) })),
  limitations: z.array(limitationSchema).default([]),
});
export type TranslatedDiet = { meals: { foodIds: string[] }[]; limitations: Limitation[] };

const EMIT_TOOL: Anthropic.Tool = {
  name: "emit_diet",
  description: "Entrega los alimentos del catálogo elegidos para cada comida del diseño.",
  input_schema: {
    type: "object",
    properties: {
      meals: {
        type: "array",
        description: "Una entrada por comida del diseño, en el mismo orden",
        items: {
          type: "object",
          properties: {
            foodIds: { type: "array", items: { type: "string" }, description: "Ids del catálogo, uno por alimento del diseño y en su orden" },
          },
          required: ["foodIds"],
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
    required: ["meals", "limitations"],
    additionalProperties: false,
  },
};

/** Fase 2 de las dietas: el diseño libre del entrenador → alimentos del catálogo, con una llamada a Claude. */
@Injectable()
export class DietTranslator {
  private readonly logger = new Logger(DietTranslator.name);

  constructor(private readonly usage: CoachUsageService) {}

  async translate(userId: string, design: DietDesign, catalog: Food[]): Promise<TranslatedDiet> {
    const lines = catalog.map((f) => `${f.id} | ${f.name} | ${f.category} | ${f.kcal}`);
    // El traductor solo ve nombres y gramos: las horas y los nombres de las comidas no le hacen falta.
    const brief = design.meals.map((m) => ({ meal: m.name, foods: m.foods }));
    let response: Anthropic.Message;
    try {
      response = await anthropic().messages.create({
        model: MODEL,
        max_tokens: TRANSLATOR_MAX_TOKENS,
        thinking: { type: "between_tools" },
        output_config: { effort: "low" },
        system: [
          { type: "text", text: DIET_TRANSLATOR_PROMPT },
          { type: "text", text: foodCatalogPrompt(lines), cache_control: { type: "ephemeral" } },
        ],
        tools: [EMIT_TOOL],
        messages: [{ role: "user", content: `Diseño del entrenador:\n${JSON.stringify(brief)}` }],
      });
    } catch (error) {
      this.logger.error(`Traducción de dieta fallida: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error("translator_unavailable");
    }

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

    const call = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "emit_diet");
    if (!call) throw new Error(response.stop_reason === "max_tokens" ? "translator_too_long" : "translator_no_output");
    const parsed = translatedSchema.safeParse(call.input);
    if (!parsed.success) throw new Error("translator_bad_output");
    return parsed.data;
  }
}
