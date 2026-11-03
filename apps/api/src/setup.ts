import type { INestApplication } from "@nestjs/common";

/** Configuración común a local y Lambda. */
export function configureApp(app: INestApplication): void {
  // Orígenes permitidos: la PWA en local y, más adelante, su dominio real.
  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:8081")
    .split(",")
    .map((o) => o.trim());

  app.enableCors({ origin: origins });
}
