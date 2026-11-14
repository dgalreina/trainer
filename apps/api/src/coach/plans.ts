import type { AiPlan } from "@trainer/shared";

/**
 * Tope mensual de tokens (entrada + salida) por plan. `gratis` no tiene IA. Son valores iniciales: se ajustan
 * viendo el uso real (Yo > Mi cuenta > Uso de la IA).
 */
export const MONTHLY_TOKEN_CAP: Record<AiPlan, number> = {
  gratis: 0,
  prueba: 200_000,
  pro: 2_000_000,
};

/**
 * Precios por millón de tokens (USD) de Sonnet 5.5. Lo cacheado se lee a 0,10 $ y se escribe a 1,25 veces el precio
 * de entrada. Si Anthropic cambia las tarifas, se actualizan aquí.
 */
export const PRICING_USD_PER_MTOK = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 };
/** Cambio USD → EUR aproximado, solo para la estimación que se enseña al usuario. */
export const USD_TO_EUR = 0.92;
