import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module.js";
import { ExercisesModule } from "./exercises/exercises.module.js";
import { HealthController } from "./health.controller.js";

// Aquí irán los módulos de la API (routines, sessions, coach...).
// Todos viven en la misma Lambda: un solo arranque en frío para toda la API.
@Module({
  imports: [
    // En local carga apps/api/.env; en Lambda las variables ya vienen del entorno.
    ConfigModule.forRoot({ isGlobal: true }),
    // La conexión se abre una vez por instancia y se reutiliza entre invocaciones.
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
        maxPoolSize: 5,
      }),
    }),
    AuthModule,
    ExercisesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
