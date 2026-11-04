import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FoodsModule } from "../foods/foods.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { DietDoc, DietSchema } from "./diet.schema.js";
import { DietsController } from "./diets.controller.js";
import { DietsService } from "./diets.service.js";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DietDoc.name, schema: DietSchema }]),
    FoodsModule,
    SettingsModule,
  ],
  controllers: [DietsController],
  providers: [DietsService],
})
export class DietsModule {}
