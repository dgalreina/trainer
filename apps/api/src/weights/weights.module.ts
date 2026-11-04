import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WeightDoc, WeightSchema } from "./weight.schema.js";
import { WeightsController } from "./weights.controller.js";
import { WeightsService } from "./weights.service.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: WeightDoc.name, schema: WeightSchema }])],
  controllers: [WeightsController],
  providers: [WeightsService],
})
export class WeightsModule {}
