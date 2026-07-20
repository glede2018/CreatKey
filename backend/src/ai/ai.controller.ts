import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { nodeCatalog } from "../workflows/node-catalog";
import { ModelCatalogService } from "./model-catalog.service";

@Controller("ai")
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly models: ModelCatalogService) {}

  @Get("catalog")
  async catalog() {
    return { nodes: nodeCatalog, models: await this.models.availableModels() };
  }
}
