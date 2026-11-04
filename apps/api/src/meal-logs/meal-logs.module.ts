import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FoodsModule } from "../foods/foods.module.js";
import { MealLogDoc, MealLogSchema } from "./meal-log.schema.js";
import { MealLogsController } from "./meal-logs.controller.js";
import { MealLogsService } from "./meal-logs.service.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: MealLogDoc.name, schema: MealLogSchema }]), FoodsModule],
  controllers: [MealLogsController],
  providers: [MealLogsService],
})
export class MealLogsModule {}
