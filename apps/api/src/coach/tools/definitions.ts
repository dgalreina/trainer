import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Las herramientas de solo lectura del entrenador. Claude lee la `description` para decidir cuándo usar cada una, así
 * que es lo más importante. Ninguna recibe `userId`: lo pone el servidor, y solo se leen datos del propio usuario.
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "getRecentSessions",
    description:
      "Los entrenos que ha hecho el usuario últimamente, del más reciente al más antiguo: fecha, duración y, por " +
      "ejercicio, sus series (repeticiones × kg). Úsala para hablar de cómo está entrenando o de qué hizo hace poco.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "integer", minimum: 1, maximum: 120, description: "Cuántos días hacia atrás (por defecto 28)" },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "Máximo de entrenos (por defecto 10)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "getExerciseProgress",
    description:
      "La evolución de un ejercicio concreto: la mejor serie de cada sesión, de la más antigua a la más reciente. " +
      "Úsala para hablar de progreso, marcas o estancamientos en un ejercicio («press de banca», «sentadilla»…).",
    input_schema: {
      type: "object",
      properties: {
        exercise: { type: "string", description: "Nombre del ejercicio, por ejemplo «press de banca»" },
        weeks: { type: "integer", minimum: 1, maximum: 52, description: "Cuántas semanas hacia atrás (por defecto 12)" },
      },
      required: ["exercise"],
      additionalProperties: false,
    },
  },
  {
    name: "getWeightTrend",
    description:
      "Cómo ha cambiado el peso del usuario: el peso medio de cada semana y cuánto ha subido o bajado respecto a la " +
      "anterior. Úsala para hablar de la evolución del peso. Un día suelto no vale: el peso varía 1-2 kg por agua y comida.",
    input_schema: {
      type: "object",
      properties: {
        weeks: { type: "integer", minimum: 1, maximum: 52, description: "Cuántas semanas hacia atrás (por defecto 12)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "getActiveTraining",
    description:
      "El entrenamiento que el usuario tiene como actual: nombre, semana en la que va y cada rutina con sus ejercicios " +
      "planeados (series, repeticiones y peso previsto). Úsala para hablar de lo que le toca entrenar o de su plan.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// Lo que Claude manda se valida siempre: no se fía de que respete el esquema.
export const recentSessionsInput = z.object({
  days: z.number().int().min(1).max(120).default(28),
  limit: z.number().int().min(1).max(20).default(10),
});
export const exerciseProgressInput = z.object({
  exercise: z.string().trim().min(1).max(100),
  weeks: z.number().int().min(1).max(52).default(12),
});
export const weightTrendInput = z.object({
  weeks: z.number().int().min(1).max(52).default(12),
});
