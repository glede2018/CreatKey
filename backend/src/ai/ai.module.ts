import { Module } from "@nestjs/common";
import { MediaModule } from "../media/media.module";
import { AiController } from "./ai.controller";
import { AkoolProvider } from "./akool.provider";
import { AiGatewayService } from "./ai-gateway.service";
import { ModelCatalogService } from "./model-catalog.service";

@Module({
  imports: [MediaModule],
  controllers: [AiController],
  providers: [AkoolProvider, AiGatewayService, ModelCatalogService],
  exports: [AiGatewayService, ModelCatalogService],
})
export class AiModule {}
