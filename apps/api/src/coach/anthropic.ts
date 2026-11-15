import Anthropic from "@anthropic-ai/sdk";
import { ServiceUnavailableException } from "@nestjs/common";

/** El modelo del entrenador (chat y traducción de entrenos). */
export const MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;

/** El cliente de Anthropic, creado la primera vez que hace falta: así la API arranca aunque no haya clave. */
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ServiceUnavailableException("El entrenador no está disponible ahora mismo.");
  }
  return (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
}
