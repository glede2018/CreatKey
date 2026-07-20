import { Module } from "@nestjs/common";
import { MediaModule } from "../media/media.module";
import { AiController } from "./ai.controller";
import { BailianProvider } from "./bailian.provider";
import { AiGatewayService } from "./ai-gateway.service";
import { ModelCatalogService } from "./model-catalog.service";

@Module({
  imports: [MediaModule],
  controllers: [AiController],
  providers: [BailianProvider, AiGatewayService, ModelCatalogService],
  exports: [AiGatewayService, ModelCatalogService],
})
export class AiModule {}
