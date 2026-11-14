import { SYSTEM_PROMPT } from "./system.js";

export { SYSTEM_PROMPT };

/** La parte de la ficha del usuario, que cambia en cada llamada (va después de la parte estable). */
export function cardPrompt(card: string): string {
  return `Ficha del usuario:\n${card}`;
}
