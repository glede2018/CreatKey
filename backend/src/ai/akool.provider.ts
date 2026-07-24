import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AiInvocationStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { MediaService } from "../media/media.service";
import type { AiExecutionContext, AiProvider } from "./ai-provider";

type RoutedInput = {
  targetHandle?: string | null;
  value?: { type?: string; value?: unknown; assets?: Array<{ url?: string; type?: string }> };
};

@Injectable()
export class AkoolProvider implements AiProvider {
  readonly id = "akool";

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async execute(
    kind: string,
    model: string,
    config: Record<string, unknown>,
    inputs: RoutedInput[],
    context?: AiExecutionContext,
  ) {
    if (!context) throw new Error("Akool 调用缺少计费上下文");
    const requestParams = this.requestParams(kind, config, inputs);
    const invocation = await this.prisma.aiModelInvocation.create({
      data: {
        modelId: context.modelDbId,
        userId: context.userId,
        workflowRunId: context.workflowRunId,
        nodeRunId: context.nodeRunId,
        status: AiInvocationStatus.SUBMITTING,
        requestParams: requestParams as Prisma.InputJsonValue,
        pricingSnapshot: context.pricingSnapshot as Prisma.InputJsonValue,
        estimatedKeys: context.chargedKeys,
        chargedKeys: context.chargedKeys,
      },
    });

    try {
      const submitted = await this.request(
        "POST",
        `/run/${encodeURIComponent(model)}`,
        requestParams,
      );
      const taskUuid = this.taskUuid(submitted);
      const submittedStatus = String(submitted.status ?? "").toLowerCase();
      const submittedComplete = ["success", "succeeded", "completed", "done"].includes(
        submittedStatus,
      );
      await this.prisma.aiModelInvocation.update({
        where: { id: invocation.id },
        data: {
          providerTaskUuid: taskUuid || null,
          providerResponse: submitted as Prisma.InputJsonValue,
          status:
            taskUuid && !submittedComplete
              ? AiInvocationStatus.PENDING
              : AiInvocationStatus.SUCCEEDED,
          submittedAt: new Date(),
        },
      });
      const result =
        taskUuid && !submittedComplete ? await this.waitTask(taskUuid, invocation.id) : submitted;
      const output = await this.normalizeOutput(kind, model, result);
      await this.prisma.aiModelInvocation.update({
        where: { id: invocation.id },
        data: {
          status: AiInvocationStatus.SUCCEEDED,
          providerResponse: result as Prisma.InputJsonValue,
          output: output as Prisma.InputJsonValue,
          providerAmountUsd: this.amount(result),
          completedAt: new Date(),
        },
      });
      return output;
    } catch (error) {
      await this.prisma.aiModelInvocation.update({
        where: { id: invocation.id },
        data: {
          status: AiInvocationStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : String(error),
          refundedKeys: context.chargedKeys,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private apiKey() {
    const value = process.env.AKOOL_API_KEY;
    if (!value) throw new ServiceUnavailableException("尚未配置 AKOOL_API_KEY");
    return value;
  }

  private apiRoot() {
    return (
      process.env.AKOOL_API_BASE_URL ?? "https://akool.com/interface/maas-backend/api/v1"
    ).replace(/\/$/, "");
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown) {
    const response = await fetch(`${this.apiRoot()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = this.stringAt(value, ["message", "msg", "error"]);
      throw new Error(message || `Akool 请求失败（${response.status}）`);
    }
    return value as Record<string, unknown>;
  }

  private async waitTask(taskUuid: string, invocationId: string) {
    const deadline = Date.now() + 20 * 60 * 1000;
    while (Date.now() < deadline) {
      const value = await this.request("GET", `/run/tasks/${encodeURIComponent(taskUuid)}`);
      const status = String(
        this.first(value, ["status", "task_status", "data.status", "data.task_status"]) ?? "",
      ).toLowerCase();
      const amount = this.amount(value);
      await this.prisma.aiModelInvocation.update({
        where: { id: invocationId },
        data: {
          status: ["running", "processing"].includes(status)
            ? AiInvocationStatus.PROCESSING
            : AiInvocationStatus.PENDING,
          providerResponse: value as Prisma.InputJsonValue,
          ...(amount ? { providerAmountUsd: amount } : {}),
        },
      });
      if (["success", "succeeded", "completed", "done"].includes(status)) return value;
      if (["failed", "error", "canceled", "cancelled"].includes(status)) {
        throw new Error(this.stringAt(value, ["message", "msg", "error"]) || `Akool 任务${status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    throw new Error("Akool 任务等待超时");
  }

  private requestParams(kind: string, config: Record<string, unknown>, inputs: RoutedInput[]) {
    const input: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (["model", "apiKey", "authorization"].includes(key) || value === undefined) continue;
      const mappedKey = key === "media" ? this.legacyMediaField(kind) : key;
      this.setPath(input, mappedKey, this.serializeConfigValue(value));
    }
    for (const routed of inputs) {
      const key =
        routed.targetHandle || (routed.value?.type === "text" ? "prompt" : routed.value?.type);
      if (!key || input[key] !== undefined) continue;
      if (routed.value?.type === "text") this.setPath(input, key, routed.value.value);
      else {
        const urls = (routed.value?.assets ?? []).map((asset) => asset.url).filter(Boolean);
        if (urls.length) this.setPath(input, key, urls.length === 1 ? urls[0] : urls);
      }
    }
    return { input };
  }

  private legacyMediaField(kind: string) {
    if (kind.includes("speech") || kind === "ai.speech-to-text") return "audio";
    if (
      kind.includes("video-processing") ||
      kind.includes("video-edit") ||
      kind.includes("video-extend") ||
      kind.includes("video-resize")
    )
      return "video";
    return "image";
  }

  private serializeConfigValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.serializeConfigValue(item));
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.url === "string" && typeof record.type === "string") return record.url;
      return Object.fromEntries(
        Object.entries(record).map(([key, item]) => [key, this.serializeConfigValue(item)]),
      );
    }
    return value;
  }

  private setPath(target: Record<string, unknown>, path: string, value: unknown) {
    const parts = path.split(".");
    let current = target;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) current[part] = value;
      else {
        if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part]))
          current[part] = {};
        current = current[part] as Record<string, unknown>;
      }
    });
  }

  private taskUuid(value: Record<string, unknown>) {
    return String(
      this.first(value, ["task_uuid", "taskUuid", "data.task_uuid", "data.taskUuid"]) ?? "",
    );
  }

  private amount(value: Record<string, unknown>) {
    const raw = this.first(value, ["amount", "data.amount", "result.amount"]);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : undefined;
  }

  private async normalizeOutput(kind: string, model: string, value: Record<string, unknown>) {
    const urls = new Set<string>();
    const visit = (item: unknown) => {
      if (typeof item === "string" && /^https?:\/\//.test(item)) urls.add(item);
      else if (Array.isArray(item)) item.forEach(visit);
      else if (item && typeof item === "object") Object.values(item).forEach(visit);
    };
    visit(value.output ?? (value.data as Record<string, unknown> | undefined)?.output ?? value);
    const mediaType = kind.includes("video")
      ? "video"
      : kind.includes("speech") || kind.includes("audio")
        ? "audio"
        : "image";
    if (urls.size) {
      const assets = await Promise.all(
        [...urls].map((url) => this.media.importRemote(url, mediaType)),
      );
      return { type: mediaType, assets, model };
    }
    return { type: "json", value, model };
  }

  private first(value: Record<string, unknown>, paths: string[]) {
    for (const path of paths) {
      const result = path
        .split(".")
        .reduce<unknown>(
          (current, key) =>
            current && typeof current === "object"
              ? (current as Record<string, unknown>)[key]
              : undefined,
          value,
        );
      if (result !== undefined && result !== null && result !== "") return result;
    }
    return undefined;
  }

  private stringAt(value: Record<string, unknown>, paths: string[]) {
    const found = this.first(value, paths);
    return typeof found === "string" ? found : "";
  }
}
