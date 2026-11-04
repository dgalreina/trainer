import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module.js";
import { getMongoUri } from "./config/mongo-uri.js";
import { DietsModule } from "./diets/diets.module.js";
import { ExercisesModule } from "./exercises/exercises.module.js";
import { FoodsModule } from "./foods/foods.module.js";
import { HealthController } from "./health.controller.js";
import { ProfileModule } from "./profile/profile.module.js";
import { SessionsModule } from "./sessions/sessions.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { TrainingsModule } from "./trainings/trainings.module.js";
import { WeightsModule } from "./weights/weights.module.js";

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
    DietsModule,
    ExercisesModule,
    FoodsModule,
    TrainingsModule,
    SettingsModule,
    SessionsModule,
    ProfileModule,
    WeightsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
