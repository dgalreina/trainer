import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module.js";
import { getMongoUri } from "./config/mongo-uri.js";
import { ExercisesModule } from "./exercises/exercises.module.js";
import { HealthController } from "./health.controller.js";
import { RoutinesModule } from "./routines/routines.module.js";
import { SessionsModule } from "./sessions/sessions.module.js";

// Aquí irán los módulos de la API (coach...).
// Todos viven en la misma Lambda: un solo arranque en frío para toda la API.
@Module({
  imports: [
    // En local carga apps/api/.env; en Lambda las variables ya vienen del entorno.
    ConfigModule.forRoot({ isGlobal: true }),
    // La conexión se abre una vez por instancia y se reutiliza entre invocaciones.
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: await getMongoUri(),
        maxPoolSize: 5,
      }),
    }),
    AuthModule,
    ExercisesModule,
    RoutinesModule,
    SessionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
