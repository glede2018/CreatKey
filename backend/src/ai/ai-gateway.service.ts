import { BadRequestException, Injectable } from "@nestjs/common";
import { BailianProvider } from "./bailian.provider";
import { aiModelCatalog } from "./model-catalog";
import type { AiProvider } from "./ai-provider";
import { ModelCatalogService } from "./model-catalog.service";

/** 按模型注册信息路由到厂商适配器；新增厂商无需改动工作流执行器。 */
@Injectable()
export class AiGatewayService {
  private readonly providers: Map<string, AiProvider>;

  constructor(
    bailian: BailianProvider,
    private readonly catalog: ModelCatalogService,
  ) {
    this.providers = new Map([[bailian.id, bailian]]);
  }

  async execute(kind: string, modelId: string, config: Record<string, unknown>, inputs: any[]) {
    const model = aiModelCatalog.find(
      (item) => item.id === modelId && item.capabilities.includes(kind),
    );
    if (!model) throw new BadRequestException(`模型 ${modelId} 不支持 ${kind}`);
    await this.catalog.assertAvailable(modelId);
    const provider = this.providers.get(model.provider);
    if (!provider) throw new BadRequestException(`模型厂商 ${model.provider} 尚未接入`);
    return provider.execute(kind, model.id, config, inputs);
  }
}
