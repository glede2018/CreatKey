import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { aiModelCatalog } from "./model-catalog";

/** 将代码模型目录与运营侧的上下架状态合并。 */
@Injectable()
export class ModelCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** 仅向创作端暴露已上架的模型。 */
  async availableModels() {
    const [disabled, costs] = await Promise.all([
      this.prisma.aiModelSetting.findMany({
        where: { active: false },
        select: { modelId: true },
      }),
      this.prisma.aiModelCapabilityCost.findMany(),
    ]);
    const disabledIds = new Set(disabled.map((item) => item.modelId));
    const costByCapability = new Map(
      costs.map((item) => [`${item.modelId}:${item.capability}`, item.keys]),
    );
    return aiModelCatalog
      .filter((model) => !disabledIds.has(model.id))
      .map((model) => ({
        ...model,
        capabilityKeys: Object.fromEntries(
          model.capabilities.map((capability) => [
            capability,
            costByCapability.get(`${model.id}:${capability}`) ?? model.capabilityKeys[capability],
          ]),
        ),
      }));
  }

  /** 返回模型在指定节点能力下的计费，数据库配置优先于代码默认值。 */
  async executionKeys(modelId: string, capability: string) {
    const definition = aiModelCatalog.find(
      (model) => model.id === modelId && model.capabilities.includes(capability),
    );
    if (!definition) throw new BadRequestException(`模型 ${modelId} 不支持当前节点`);
    const configured = await this.prisma.aiModelCapabilityCost.findUnique({
      where: { modelId_capability: { modelId, capability } },
    });
    return configured?.keys ?? definition.capabilityKeys[capability] ?? 0;
  }

  /** 模型执行前再次校验，防止已保存工作流绕过上下架控制。 */
  async assertAvailable(modelId: string) {
    const setting = await this.prisma.aiModelSetting.findUnique({ where: { modelId } });
    if (setting?.active === false) throw new BadRequestException(`模型 ${modelId} 已下架`);
  }
}
