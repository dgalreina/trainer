import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { StepDoc, StepSchema } from "./step.schema.js";
import { StepsController } from "./steps.controller.js";
import { StepsService } from "./steps.service.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: StepDoc.name, schema: StepSchema }])],
  controllers: [StepsController],
  providers: [StepsService],
  exports: [StepsService],
})
export class StepsModule {}
