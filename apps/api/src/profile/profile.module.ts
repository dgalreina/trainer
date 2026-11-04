import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProfileController } from "./profile.controller.js";
import { ProfileDoc, ProfileSchema } from "./profile.schema.js";
import { ProfileService } from "./profile.service.js";

@Module({
  imports: [MongooseModule.forFeature([{ name: ProfileDoc.name, schema: ProfileSchema }])],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
