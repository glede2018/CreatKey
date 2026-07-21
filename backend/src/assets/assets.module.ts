import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { BillingModule } from "../billing/billing.module";
import { MediaModule } from "../media/media.module";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  imports: [MediaModule, AiModule, BillingModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
