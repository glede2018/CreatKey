import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { validateDag, workflowDefinitionSchema } from "./workflow.schema";

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 按更新时间倒序列出用户拥有的工作流。 */
  list(ownerId: string) {
    return this.prisma.workflow.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" } });
  }

  /** 查询用户拥有的指定工作流，防止跨用户访问。 */
  async findOwned(id: string, ownerId: string) {
    const workflow = await this.prisma.workflow.findFirst({ where: { id, ownerId } });
    if (!workflow) throw new NotFoundException("工作流不存在");
    return workflow;
  }

  /** 校验 JSON 结构及 DAG 约束，并返回类型安全的定义。 */
  private parse(value: unknown) {
    const result = workflowDefinitionSchema.safeParse(value);
    if (!result.success)
      throw new BadRequestException({ message: "工作流格式无效", issues: result.error.issues });
    try {
      validateDag(result.data);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    return result.data;
  }

  /** 创建新的工作流。 */
  create(ownerId: string, body: { name?: string; description?: string; definition?: unknown }) {
    const definition = this.parse(body.definition);
    return this.prisma.workflow.create({
      data: {
        ownerId,
        name: body.name?.trim() || "未命名工作流",
        description: body.description,
        definition: definition as any,
      },
    });
  }

  /** 校验所有权后更新工作流元数据与定义。 */
  async update(
    id: string,
    ownerId: string,
    body: { name?: string; description?: string; definition?: unknown },
  ) {
    await this.findOwned(id, ownerId);
    const definition = this.parse(body.definition);
    return this.prisma.workflow.update({
      where: { id },
      data: {
        name: body.name?.trim() || "未命名工作流",
        description: body.description,
        definition: definition as any,
      },
    });
  }
}
