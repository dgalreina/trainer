import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { configure as serverlessExpress } from "@codegenie/serverless-express";
import type { Handler } from "aws-lambda";
import { AppModule } from "./app.module.js";
import { configureApp } from "./setup.js";

// Handler de AWS Lambda para TODA la API normal (CRUD).
// Se crea una sola vez por instancia: las peticiones siguientes reutilizan la app.
// El chat con streaming irá en un handler aparte (ver CLAUDE.md).
let cached: Handler | undefined;

async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  configureApp(app);
  await app.init();
  return serverlessExpress({ app: app.getHttpAdapter().getInstance() });
}

export const handler: Handler = async (event, context, callback) => {
  cached = cached ?? (await bootstrap());
  return cached(event, context, callback);
};
