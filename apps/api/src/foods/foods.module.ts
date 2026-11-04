import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FoodDoc, FoodSchema } from "./food.schema.js";
import { FoodsController } from "./foods.controller.js";
import { FoodsService } from "./foods.service.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: FoodDoc.name, schema: FoodSchema }])],
  controllers: [FoodsController],
  providers: [FoodsService],
  exports: [FoodsService],
})
export class FoodsModule {}
