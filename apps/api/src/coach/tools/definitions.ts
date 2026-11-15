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
  {
    name: "searchExercises",
    description:
      "Busca ejercicios en el catálogo de la app por nombre (tolera erratas y palabras sueltas): devuelve los que existen, " +
      "con su categoría. Úsala al diseñar un entrenamiento para usar nombres de ejercicios que existen y ver qué opciones hay " +
      "de un movimiento. Si no hay resultados, puedes diseñar con ese ejercicio igualmente.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Nombre o parte del nombre, por ejemplo «curl femoral» o «remo»" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "proposeTraining",
    description:
      "Propone al usuario un entrenamiento completo que acabas de diseñar. Diséñalo como lo haría un buen entrenador, sin " +
      "preocuparte de cómo se guarda: ejercicios por su nombre, cada serie con sus repeticiones (un número por serie) y " +
      "peso orientativo si lo sabes, y técnicas especiales y notas en texto libre (por ejemplo «rest-pause solo en la " +
      "última serie»). La app lo convertirá y le enseñará al usuario una tarjeta para guardarlo; no se guarda sin que él " +
      "lo acepte. Llámala UNA vez con el entrenamiento entero.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del entrenamiento, por ejemplo «Fuerza»" },
        durationWeeks: { type: "integer", minimum: 1, maximum: 52, description: "Duración en semanas (por defecto 8)" },
        days: {
          type: "array",
          description: "Un día de entreno cada uno, en orden",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Por ejemplo «Pecho + Tríceps»" },
              restSeconds: { type: "integer", description: "Descanso entre series de este día, en segundos" },
              exercises: {
                type: "array",
                description: "Los ejercicios del día, en el orden en que se hacen",
                items: {
                  type: "object",
                  properties: {
                    exercise: { type: "string", description: "Nombre del ejercicio" },
                    sets: {
                      type: "array",
                      description: "Una entrada por serie, en orden",
                      items: {
                        type: "object",
                        properties: {
                          reps: { type: "integer", description: "Repeticiones de esa serie" },
                          weightKg: { type: "number", description: "Peso orientativo en kg, solo si lo sabes" },
                        },
                        additionalProperties: false,
                      },
                    },
                    technique: {
                      type: "string",
                      description: "Técnica especial en texto libre (superserie con el siguiente, rest-pause, descendente…), si la hay",
                    },
                    notes: { type: "string", description: "Indicaciones para ese ejercicio" },
                  },
                  required: ["exercise", "sets"],
                  additionalProperties: false,
                },
              },
            },
            required: ["exercises"],
            additionalProperties: false,
          },
        },
      },
      required: ["name", "days"],
      additionalProperties: false,
    },
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
export const searchExercisesInput = z.object({
  query: z.string().trim().min(1).max(100),
});
// El diseño libre lo valida el esquema compartido: es el mismo que usa el traductor.
export { trainingDesignSchema } from "@trainer/shared";
