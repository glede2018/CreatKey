import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { NodeRunStatus, RunStatus } from "@prisma/client";
import type { Queue } from "bullmq";
import { AiGatewayService } from "../ai/ai-gateway.service";
import { ModelCatalogService } from "../ai/model-catalog.service";
import { PointsService } from "../billing/points.service";
import { PrismaService } from "../database/prisma.service";
import {
  collectExecutionIssues,
  executionDefinition,
  validateDag,
  workflowDefinitionSchema,
  type WorkflowDefinition,
} from "../workflows/workflow.schema";
import { nodeExecutionKeys } from "../workflows/node-catalog";

const kindsByLabel: Record<string, string> = {
  提示词: "input.text",
  提示词优化: "transform.template",
  图像生成: "image.generate",
};

const nodeKind = (node: WorkflowDefinition["nodes"][number]) =>
  node.data.kind ??
  String(node.data.config?.kind ?? kindsByLabel[node.data.label] ?? "utility.passthrough");

function errorDetails(error: unknown) {
  const value = error as {
    name?: string;
    message?: string;
    status?: number;
    code?: string;
    providerTaskId?: string;
  };
  return {
    name: value?.name ?? "Error",
    message: value?.message ?? "节点执行失败",
    status: value?.status,
    code: value?.code,
    providerTaskId: value?.providerTaskId,
  };
}

@Injectable()
export class ExecutionsService implements OnModuleInit, OnModuleDestroy {
  private recoveryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    private readonly aiGateway: AiGatewayService,
    private readonly models: ModelCatalogService,
    @InjectQueue("workflow-nodes") private readonly queue: Queue,
  ) {}

  onModuleInit() {
    this.recoveryTimer = setInterval(() => void this.recoverExpiredRuns(), 60_000);
    this.recoveryTimer.unref();
  }

  onModuleDestroy() {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
  }

  /** 将超时运行置为失败并释放锁，避免服务异常后工作流永久不可编辑。 */
  private async recoverExpiredRuns() {
    const timeoutMs = Number(process.env.WORKFLOW_RUN_TIMEOUT_MS ?? 6 * 60 * 60 * 1000);
    const expired = await this.prisma.workflowRun.findMany({
      where: {
        status: RunStatus.RUNNING,
        startedAt: { lt: new Date(Date.now() - timeoutMs) },
      },
      include: { nodeRuns: true },
    });
    for (const run of expired) {
      const finishedAt = new Date();
      const claimed = await this.prisma.workflowRun.updateMany({
        where: { id: run.id, status: RunStatus.RUNNING },
        data: {
          status: RunStatus.FAILED,
          error: "工作流运行超时",
          finishedAt,
          durationMs: run.startedAt ? finishedAt.getTime() - run.startedAt.getTime() : timeoutMs,
        },
      });
      if (!claimed.count) continue;
      await this.prisma.$transaction([
        this.prisma.nodeRun.updateMany({
          where: { runId: run.id, status: NodeRunStatus.RUNNING },
          data: { status: NodeRunStatus.FAILED, error: "节点运行超时", finishedAt },
        }),
        this.prisma.nodeRun.updateMany({
          where: {
            runId: run.id,
            status: { in: [NodeRunStatus.PENDING, NodeRunStatus.QUEUED] },
          },
          data: { status: NodeRunStatus.SKIPPED, error: "工作流运行超时", finishedAt },
        }),
        this.prisma.workflow.updateMany({
          where: { id: run.workflowId, activeRunId: run.id },
          data: { activeRunId: null, lockedAt: null },
        }),
      ]);
      const actualCost = run.nodeRuns
        .filter((node) => node.status === NodeRunStatus.SUCCEEDED)
        .reduce((sum, node) => sum + node.cost, 0);
      await this.points.settle(run.id, actualCost);
    }
  }

  private parse(value: unknown) {
    const parsed = workflowDefinitionSchema.parse(value);
    validateDag(parsed);
    return parsed;
  }

  /** 校验数据库中的工作流 JSON，创建运行并原子设置编辑锁。 */
  async start(workflowId: string, userId: string, targetNodeId?: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, ownerId: userId },
    });
    if (!workflow) throw new NotFoundException("工作流不存在");
    if (workflow.activeRunId) throw new ConflictException("工作流已经在运行");

    let definition: WorkflowDefinition;
    try {
      definition = this.parse(workflow.definition);
    } catch (error) {
      throw new BadRequestException((error as Error).message || "工作流不是有效 DAG");
    }
    let runnableDefinition: WorkflowDefinition;
    try {
      runnableDefinition = executionDefinition(definition, targetNodeId);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const issues = collectExecutionIssues(runnableDefinition);
    if (issues.length) {
      throw new BadRequestException({ message: issues[0].message, issues });
    }

    const nodeCosts = new Map(
      await Promise.all(
        runnableDefinition.nodes.map(
          async (node) => [node.id, await this.executionKeys(node)] as const,
        ),
      ),
    );
    const totalCost = [...nodeCosts.values()].reduce((sum, cost) => sum + cost, 0);
    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workflowRun.create({
        data: {
          workflowId,
          userId,
          status: RunStatus.RUNNING,
          startedAt: new Date(),
          nodeRuns: {
            create: runnableDefinition.nodes.map((node) => ({
              nodeKey: node.id,
              nodeType: nodeKind(node),
              cost: nodeCosts.get(node.id) ?? 0,
            })),
          },
        },
        include: { nodeRuns: true },
      });
      const locked = await tx.workflow.updateMany({
        where: { id: workflowId, ownerId: userId, activeRunId: null },
        data: { activeRunId: created.id, lockedAt: new Date() },
      });
      if (!locked.count) throw new ConflictException("工作流已经在运行");
      return created;
    });

    try {
      await this.points.reserve(userId, run.id, totalCost);
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.workflow.updateMany({
          where: { id: workflowId, activeRunId: run.id },
          data: { activeRunId: null, lockedAt: null },
        }),
        this.prisma.workflowRun.delete({ where: { id: run.id } }),
      ]);
      throw error;
    }

    const incoming = new Set(runnableDefinition.edges.map((edge) => edge.target));
    try {
      await Promise.all(
        runnableDefinition.nodes
          .filter((node) => !incoming.has(node.id))
          .map((node) => this.enqueue(run.id, node.id)),
      );
    } catch (error) {
      const finishedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: RunStatus.FAILED,
            error: "任务队列调度失败",
            finishedAt,
            durationMs: run.startedAt ? finishedAt.getTime() - run.startedAt.getTime() : 0,
          },
        }),
        this.prisma.nodeRun.updateMany({
          where: { runId: run.id },
          data: { status: NodeRunStatus.SKIPPED, finishedAt },
        }),
        this.prisma.workflow.updateMany({
          where: { id: workflowId, activeRunId: run.id },
          data: { activeRunId: null, lockedAt: null },
        }),
      ]);
      await this.points.settle(run.id, 0);
      throw error;
    }
    return this.get(run.id, userId);
  }

  async get(id: string, userId: string) {
    const run = await this.prisma.workflowRun.findFirst({
      where: { id, userId },
      include: { nodeRuns: { orderBy: { createdAt: "asc" } } },
    });
    if (!run) throw new NotFoundException("运行记录不存在");
    return run;
  }

  /** 取消运行并立即解除编辑锁；迟到的供应商结果会被忽略。 */
  async cancel(id: string, userId: string) {
    const run = await this.get(id, userId);
    if (run.status !== RunStatus.PENDING && run.status !== RunStatus.RUNNING) return run;
    const now = new Date();
    const durationMs = run.startedAt ? now.getTime() - run.startedAt.getTime() : 0;
    await this.prisma.$transaction([
      this.prisma.workflowRun.update({
        where: { id },
        data: { status: RunStatus.CANCELED, finishedAt: now, durationMs },
      }),
      this.prisma.nodeRun.updateMany({
        where: {
          runId: id,
          status: {
            in: [NodeRunStatus.PENDING, NodeRunStatus.QUEUED, NodeRunStatus.RUNNING],
          },
        },
        data: { status: NodeRunStatus.CANCELED, finishedAt: now },
      }),
      this.prisma.workflow.updateMany({
        where: { id: run.workflowId, activeRunId: id },
        data: { activeRunId: null, lockedAt: null },
      }),
    ]);
    await this.points.settle(id, 0);
    return this.get(id, userId);
  }

  private async enqueue(runId: string, nodeKey: string) {
    const claimed = await this.prisma.nodeRun.updateMany({
      where: { runId, nodeKey, status: NodeRunStatus.PENDING },
      data: { status: NodeRunStatus.QUEUED },
    });
    if (claimed.count) {
      await this.queue.add(
        "execute-node",
        { runId, nodeKey },
        { jobId: `${runId}-${nodeKey}`, attempts: 1, removeOnComplete: 500, removeOnFail: 1000 },
      );
    }
  }

  /** 单个 worker 任务只负责一个节点；相互独立的入口会被 BullMQ 并行消费。 */
  async executeNode(runId: string, nodeKey: string) {
    const startedAt = new Date();
    const claimed = await this.prisma.nodeRun.updateMany({
      where: { runId, nodeKey, status: NodeRunStatus.QUEUED },
      data: { status: NodeRunStatus.RUNNING, startedAt, attempt: { increment: 1 } },
    });
    if (!claimed.count) return;

    const run = await this.prisma.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: { workflow: true, nodeRuns: true },
    });
    if (run.status !== RunStatus.RUNNING) return;
    const definition = this.parse(run.workflow.definition);
    const node = definition.nodes.find((item) => item.id === nodeKey);
    if (!node) throw new Error(`运行节点不存在：${nodeKey}`);
    const incomingEdges = definition.edges.filter((edge) => edge.target === nodeKey);
    const inputs = incomingEdges.map((edge) => ({
      sourceNode: edge.source,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      value: run.nodeRuns.find((item) => item.nodeKey === edge.source)?.output,
    }));

    try {
      const output = await this.runExecutor(nodeKind(node), node.data.config, inputs);
      const finishedAt = new Date();
      const updated = await this.prisma.nodeRun.updateMany({
        where: { runId, nodeKey, status: NodeRunStatus.RUNNING },
        data: {
          status: NodeRunStatus.SUCCEEDED,
          input: inputs as never,
          output: output as never,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });
      if (!updated.count) return;
      await this.advance(runId, nodeKey, definition);
    } catch (error) {
      const finishedAt = new Date();
      const details = errorDetails(error);
      await this.prisma.nodeRun.updateMany({
        where: { runId, nodeKey, status: NodeRunStatus.RUNNING },
        data: {
          status: NodeRunStatus.FAILED,
          input: inputs as never,
          error: details.message,
          errorDetails: details as never,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });
      await this.skipDescendants(runId, nodeKey, definition);
      await this.finishIfComplete(runId);
    }
  }

  private async runExecutor(kind: string, config: Record<string, unknown>, inputs: unknown[]) {
    if (kind === "input.text") return { type: "text", value: String(config.text ?? "") };
    if (["input.image", "input.audio", "input.video"].includes(kind)) {
      const asset = config.media;
      if (!asset) throw new Error("输入节点尚未上传文件");
      return { type: kind.split(".")[1], assets: [asset] };
    }
    if (kind === "transform.template") {
      const first = inputs[0] as { value?: { text?: unknown } } | undefined;
      const raw = first?.value?.text ?? JSON.stringify(first?.value ?? "");
      return { text: String(config.template ?? "{{input}}").replaceAll("{{input}}", String(raw)) };
    }
    if (kind === "image.generate") {
      const first = inputs[0] as { value?: { text?: unknown } } | undefined;
      const prompt = first?.value?.text ?? String(config.prompt ?? "");
      return {
        prompt,
        artifact: {
          type: "image",
          url: `https://placehold.co/1024x1024/111/EEE?text=${encodeURIComponent(String(prompt).slice(0, 24) || "CreatKey")}`,
        },
      };
    }
    if (kind.startsWith("ai.")) {
      const model = String(config.model ?? "");
      if (!model) throw new Error("AI 节点尚未选择模型");
      return this.aiGateway.execute(kind, model, config, inputs);
    }
    return { value: inputs[0] ?? config };
  }

  private executionKeys(node: WorkflowDefinition["nodes"][number]) {
    const kind = nodeKind(node);
    if (!kind.startsWith("ai.")) return Promise.resolve(nodeExecutionKeys(kind));
    return this.models.executionKeys(String(node.data.config.model ?? ""), kind);
  }

  private async skipDescendants(
    runId: string,
    failedNodeKey: string,
    definition: WorkflowDefinition,
  ) {
    const descendants = new Set<string>();
    const queue = [failedNodeKey];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of definition.edges.filter((item) => item.source === current)) {
        if (!descendants.has(edge.target)) {
          descendants.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    if (!descendants.size) return;
    await this.prisma.nodeRun.updateMany({
      where: {
        runId,
        nodeKey: { in: [...descendants] },
        status: { in: [NodeRunStatus.PENDING, NodeRunStatus.QUEUED] },
      },
      data: {
        status: NodeRunStatus.SKIPPED,
        error: `上游节点 ${failedNodeKey} 执行失败`,
        finishedAt: new Date(),
      },
    });
  }

  private async advance(runId: string, nodeKey: string, definition: WorkflowDefinition) {
    const successors = new Set(
      definition.edges.filter((edge) => edge.source === nodeKey).map((edge) => edge.target),
    );
    for (const successor of successors) {
      const required = definition.edges
        .filter((edge) => edge.target === successor)
        .map((edge) => edge.source);
      const predecessors = await this.prisma.nodeRun.findMany({
        where: { runId, nodeKey: { in: required } },
        select: { status: true },
      });
      if (predecessors.every((item) => item.status === NodeRunStatus.SUCCEEDED)) {
        await this.enqueue(runId, successor);
      }
    }
    await this.finishIfComplete(runId);
  }

  private async finishIfComplete(runId: string) {
    const remaining = await this.prisma.nodeRun.count({
      where: {
        runId,
        status: {
          in: [NodeRunStatus.PENDING, NodeRunStatus.QUEUED, NodeRunStatus.RUNNING],
        },
      },
    });
    if (remaining) return;

    const run = await this.prisma.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: { nodeRuns: true },
    });
    if (run.status !== RunStatus.RUNNING) return;
    const failed = run.nodeRuns.filter((node) => node.status === NodeRunStatus.FAILED);
    const actualCost = run.nodeRuns
      .filter((node) => node.status === NodeRunStatus.SUCCEEDED)
      .reduce((sum, node) => sum + node.cost, 0);
    const finishedAt = new Date();
    const status = failed.length ? RunStatus.FAILED : RunStatus.SUCCEEDED;
    const updated = await this.prisma.workflowRun.updateMany({
      where: { id: runId, status: RunStatus.RUNNING },
      data: {
        status,
        cost: actualCost,
        error: failed.length ? `${failed.length} 个节点执行失败` : null,
        finishedAt,
        durationMs: run.startedAt ? finishedAt.getTime() - run.startedAt.getTime() : 0,
      },
    });
    if (!updated.count) return;
    await this.prisma.workflow.updateMany({
      where: { id: run.workflowId, activeRunId: runId },
      data: { activeRunId: null, lockedAt: null },
    });
    await this.points.settle(runId, actualCost);
  }
}
