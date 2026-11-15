import { z } from "zod";
import { createRoutineSchema, MAX_REST_SECONDS, routineSlotSchema } from "./routine";
import { MAX_TRAINING_WEEKS } from "./training";

/**
 * El diseño LIBRE de un entrenamiento, tal como lo piensa el entrenador (fase 1): sin conocer cómo lo guarda la app. Los
 * ejercicios van por nombre y la técnica y las notas son texto libre («rest-pause solo en la 3.ª serie»). Un traductor
 * lo convierte después al formato de la app (fase 2).
 */
export const trainingDesignSchema = z.object({
  name: z.string().trim().min(1).max(100),
  durationWeeks: z.number().int().min(1).max(MAX_TRAINING_WEEKS).default(8),
  days: z
    .array(
      z.object({
        name: z.string().trim().max(100).default(""),
        restSeconds: z.number().int().min(0).max(MAX_REST_SECONDS).optional(),
        exercises: z
          .array(
            z.object({
              exercise: z.string().trim().min(1).max(120),
              sets: z
                .array(
                  z.object({
                    reps: z.number().int().min(0).max(200).optional(),
                    weightKg: z.number().min(0).max(1000).optional(),
                  }),
                )
                .min(1)
                .max(12),
              technique: z.string().trim().max(300).optional(),
              notes: z.string().trim().max(500).optional(),
            }),
          )
          .min(1)
          .max(15),
      }),
    )
    .min(1)
    .max(7),
});
export type TrainingDesign = z.infer<typeof trainingDesignSchema>;

/** Algo del diseño que la app no puede representar tal cual. Solo lo ve el administrador (panel de sugerencias). */
export const limitationSchema = z.object({
  /** Identificador corto y estable para agrupar casos iguales, por ejemplo `technique_partial_sets`. */
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_:.-]{3,80}$/),
  text: z.string().trim().min(1).max(400),
});
export type Limitation = z.infer<typeof limitationSchema>;

/** El entrenamiento ya traducido al formato de la app (fase 2): ejercicios del catálogo por id. */
export const trainingProposalPayloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  durationWeeks: z.number().int().min(1).max(MAX_TRAINING_WEEKS),
  routines: z
    .array(
      createRoutineSchema.extend({
        slots: z.array(routineSlotSchema.extend({ exerciseName: z.string() })).min(1),
      }),
    )
    .min(1)
    .max(7),
});
export type TrainingProposalPayload = z.infer<typeof trainingProposalPayloadSchema>;

export const PROPOSAL_STATUSES = ["pending", "accepted", "rejected"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** La propuesta tal como la ve la app: una tarjeta en el chat con «Guardar como mi entrenamiento». */
export interface TrainingProposal {
  id: string;
  status: ProposalStatus;
  training: TrainingProposalPayload;
  /** Si ya se aceptó: el id del entrenamiento que se creó (para abrirlo desde la tarjeta). */
  trainingId?: string;
}

/** Lo que manda la app al aceptar una propuesta: desde cuándo empieza y si pasa a ser el entrenamiento actual. */
export const acceptProposalSchema = z.object({
  startDate: z.iso.date(),
  setActive: z.boolean().default(false),
});
export type AcceptProposal = z.infer<typeof acceptProposalSchema>;
