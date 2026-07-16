import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { NodeRunStatus, RunStatus } from "@prisma/client";
import type { Queue } from "bullmq";
import { PrismaService } from "../database/prisma.service";
import { PointsService } from "../billing/points.service";
import {
  validateDag,
  workflowDefinitionSchema,
  type WorkflowDefinition,
} from "../workflows/workflow.schema";

const kindsByLabel: Record<string, string> = {
  提示词: "input.text",
  提示词优化: "transform.template",
  图像生成: "image.generate",
};
/** 优先读取节点配置中的 kind，并兼容旧版中文节点标签。 */
const nodeKind = (node: any) =>
  node.data.config?.kind ?? kindsByLabel[node.data.label] ?? "utility.passthrough";

/** 返回节点执行完成后应消耗的 Keys。 */
const nodeCost = (kind: string) =>
  kind === "image.generate" ? 10 : kind === "transform.template" ? 1 : 0;

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    @InjectQueue("workflow-nodes") private readonly queue: Queue,
  ) {}

  /** 解析工作流快照并确认其为合法 DAG。 */
  private parse(value: unknown) {
    const parsed = workflowDefinitionSchema.parse(value);
    validateDag(parsed);
    return parsed;
  }

  /** 固化工作流版本、预冻结 Keys，并把所有入口节点加入执行队列。 */
  async start(workflowId: string, userId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, ownerId: userId },
    });
    if (!workflow) throw new NotFoundException("工作流不存在");
    let definition: WorkflowDefinition;
    try {
      definition = this.parse(workflow.definition);
    } catch {
      throw new BadRequestException("工作流不是有效 DAG");
    }
    const totalCost = definition.nodes.reduce((sum, node) => sum + nodeCost(nodeKind(node)), 0);
    const latest = await this.prisma.workflowVersion.aggregate({
      where: { workflowId },
      _max: { number: true },
    });
    const run = await this.prisma.$transaction(async (tx) => {
      const version = await tx.workflowVersion.create({
        data: { workflowId, number: (latest._max.number ?? 0) + 1, definition: definition as any },
      });
      return tx.workflowRun.create({
        data: {
          workflowId,
          versionId: version.id,
          userId,
          status: RunStatus.RUNNING,
          startedAt: new Date(),
          nodeRuns: {
            create: definition.nodes.map((node) => ({
              nodeKey: node.id,
              nodeType: nodeKind(node),
            })),
          },
        },
        include: { nodeRuns: true },
      });
    });
    try {
      await this.points.reserve(userId, run.id, totalCost);
    } catch (error) {
      await this.prisma.workflowRun.delete({ where: { id: run.id } });
      throw error;
    }
    const incoming = new Set(definition.edges.map((edge) => edge.target));
    await Promise.all(
      definition.nodes
        .filter((node) => !incoming.has(node.id))
        .map((node) => this.enqueue(run.id, node.id)),
    );
    return this.get(run.id, userId);
  }

  /** 查询属于指定用户的运行及其节点状态。 */
  async get(id: string, userId: string) {
    const run = await this.prisma.workflowRun.findFirst({
      where: { id, userId },
      include: { nodeRuns: { orderBy: { createdAt: "asc" } } },
    });
    if (!run) throw new NotFoundException("运行记录不存在");
    return run;
  }

  /** 取消运行、标记未执行节点并释放全部冻结 Keys。 */
  async cancel(id: string, userId: string) {
    const run = await this.get(id, userId);
    if (run.status !== RunStatus.PENDING && run.status !== RunStatus.RUNNING) return run;
    await this.prisma.$transaction([
      this.prisma.workflowRun.update({
        where: { id },
        data: { status: RunStatus.CANCELED, finishedAt: new Date() },
      }),
      this.prisma.nodeRun.updateMany({
        where: { runId: id, status: { in: [NodeRunStatus.PENDING, NodeRunStatus.QUEUED] } },
        data: { status: NodeRunStatus.CANCELED, finishedAt: new Date() },
      }),
    ]);
    await this.points.settle(id, 0);
    return this.get(id, userId);
  }

  /** 原子认领待执行节点并提交 BullMQ，避免重复入队。 */
  private async enqueue(runId: string, nodeKey: string) {
    const claimed = await this.prisma.nodeRun.updateMany({
      where: { runId, nodeKey, status: NodeRunStatus.PENDING },
      data: { status: NodeRunStatus.QUEUED },
    });
    if (claimed.count)
      await this.queue.add(
        "execute-node",
        { runId, nodeKey },
        { jobId: `${runId}-${nodeKey}`, attempts: 1, removeOnComplete: 500, removeOnFail: 1000 },
      );
  }

  /** 执行单个节点，保存输入输出，并在成功后推进后继节点。 */
  async executeNode(runId: string, nodeKey: string) {
    const claimed = await this.prisma.nodeRun.updateMany({
      where: { runId, nodeKey, status: NodeRunStatus.QUEUED },
      data: { status: NodeRunStatus.RUNNING, startedAt: new Date(), attempt: { increment: 1 } },
    });
    if (!claimed.count) return;
    const run = await this.prisma.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: { version: true, nodeRuns: true },
    });
    if (run.status !== RunStatus.RUNNING) return;
    const definition = this.parse(run.version.definition);
    const node = definition.nodes.find((item) => item.id === nodeKey)!;
    const predecessors = definition.edges
      .filter((edge) => edge.target === nodeKey)
      .map((edge) => edge.source);
    const inputs = run.nodeRuns
      .filter((item) => predecessors.includes(item.nodeKey))
      .map((item) => item.output);
    try {
      const output = await this.runExecutor(nodeKind(node), node.data.config, inputs);
      await this.prisma.nodeRun.update({
        where: { runId_nodeKey: { runId, nodeKey } },
        data: {
          status: NodeRunStatus.SUCCEEDED,
          input: inputs as any,
          output: output as any,
          finishedAt: new Date(),
        },
      });
      await this.advance(runId, nodeKey, definition);
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.nodeRun.update({
          where: { runId_nodeKey: { runId, nodeKey } },
          data: {
            status: NodeRunStatus.FAILED,
            error: (error as Error).message,
            finishedAt: new Date(),
          },
        }),
        this.prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: RunStatus.FAILED,
            error: `节点 ${nodeKey} 执行失败`,
            finishedAt: new Date(),
          },
        }),
        this.prisma.nodeRun.updateMany({
          where: { runId, status: { in: [NodeRunStatus.PENDING, NodeRunStatus.QUEUED] } },
          data: { status: NodeRunStatus.SKIPPED, finishedAt: new Date() },
        }),
      ]);
      const completed = run.nodeRuns
        .filter((item) => item.status === NodeRunStatus.SUCCEEDED)
        .reduce((sum, item) => sum + nodeCost(item.nodeType), 0);
      await this.points.settle(runId, completed);
      throw error;
    }
  }

  /** 根据节点类型执行对应逻辑；图像节点当前返回开发占位结果。 */
  private async runExecutor(kind: string, config: Record<string, unknown>, inputs: unknown[]) {
    if (kind === "input.text") return { text: String(config.text ?? "") };
    if (kind === "transform.template") {
      const raw = (inputs[0] as any)?.text ?? JSON.stringify(inputs[0] ?? "");
      return { text: String(config.template ?? "{{input}}").replaceAll("{{input}}", raw) };
    }
    if (kind === "image.generate") {
      const prompt = (inputs[0] as any)?.text ?? String(config.prompt ?? "");
      await new Promise((resolve) => setTimeout(resolve, 900));
      return {
        prompt,
        artifact: {
          type: "image",
          url: `https://placehold.co/1024x1024/111/EEE?text=${encodeURIComponent(prompt.slice(0, 24) || "CreatKey")}`,
        },
      };
    }
    return { value: inputs[0] ?? config };
  }

  /** 在依赖全部成功后调度后继节点，并在全图结束时完成 Keys 结算。 */
  private async advance(runId: string, nodeKey: string, definition: WorkflowDefinition) {
    const successors = definition.edges
      .filter((edge) => edge.source === nodeKey)
      .map((edge) => edge.target);
    for (const successor of new Set(successors)) {
      const required = definition.edges
        .filter((edge) => edge.target === successor)
        .map((edge) => edge.source);
      const done = await this.prisma.nodeRun.count({
        where: { runId, nodeKey: { in: required }, status: NodeRunStatus.SUCCEEDED },
      });
      if (done === required.length) await this.enqueue(runId, successor);
    }
    const remaining = await this.prisma.nodeRun.count({
      where: {
        runId,
        status: { in: [NodeRunStatus.PENDING, NodeRunStatus.QUEUED, NodeRunStatus.RUNNING] },
      },
    });
    if (!remaining) {
      const nodeRuns = await this.prisma.nodeRun.findMany({ where: { runId } });
      const actual = nodeRuns
        .filter((node) => node.status === NodeRunStatus.SUCCEEDED)
        .reduce((sum, node) => sum + nodeCost(node.nodeType), 0);
      const updated = await this.prisma.workflowRun.updateMany({
        where: { id: runId, status: RunStatus.RUNNING },
        data: { status: RunStatus.SUCCEEDED, cost: actual, finishedAt: new Date() },
      });
      if (updated.count) await this.points.settle(runId, actual);
    }
  }
}
