import { Injectable } from "@nestjs/common";
import type { AiExecutionContext, AiProvider } from "./ai-provider";
import { AkoolProvider } from "./akool.provider";
import { ModelCatalogService } from "./model-catalog.service";

type GatewayContext = Partial<Pick<AiExecutionContext, "userId" | "workflowRunId" | "nodeRunId">>;

@Injectable()
export class AiGatewayService {
  private readonly providers: Map<string, AiProvider>;

  constructor(
    akool: AkoolProvider,
    private readonly catalog: ModelCatalogService,
  ) {
    this.providers = new Map([[akool.id, akool]]);
  }

  async execute(
    kind: string,
    modelId: string,
    config: Record<string, unknown>,
    inputs: any[],
    context: GatewayContext = {},
  ) {
    const model = await this.catalog.requireAvailable(modelId, kind);
    const pricing = await this.catalog.executionPricing(modelId, kind, config);
    const provider = this.providers.get("akool")!;
    return provider.execute(kind, model.providerModelId, config, inputs, {
      ...context,
      modelDbId: model.id,
      chargedKeys: pricing.keys,
      pricingSnapshot: pricing.snapshot,
    });
  }
}
