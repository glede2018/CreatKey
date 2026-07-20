import { getNodeDefinition } from "@/lib/workflow-catalog";
import type { WorkflowDefinition, WorkflowPort } from "@/types";

export interface WorkflowValidationIssue {
  nodeId: string;
  portId?: string;
  message: string;
}

/** 提取目标节点及其全部上游依赖，供单节点执行校验和费用预估复用。 */
export function workflowExecutionDefinition(
  definition: WorkflowDefinition,
  targetNodeId?: string,
): WorkflowDefinition {
  if (!targetNodeId) return definition;
  if (!definition.nodes.some((node) => node.id === targetNodeId)) {
    throw new Error("要执行的节点不存在");
  }
  const included = new Set([targetNodeId]);
  const pending = [targetNodeId];
  while (pending.length) {
    const target = pending.shift()!;
    for (const edge of definition.edges.filter((item) => item.target === target)) {
      if (included.has(edge.source)) continue;
      included.add(edge.source);
      pending.push(edge.source);
    }
  }
  return {
    ...definition,
    nodes: definition.nodes.filter((node) => included.has(node.id)),
    edges: definition.edges.filter(
      (edge) => included.has(edge.source) && included.has(edge.target),
    ),
  };
}

/** 严格校验用户导入的 JSON，避免非法节点、端口和环路进入编辑器。 */
export function parseImportedWorkflow(value: unknown): WorkflowDefinition {
  if (!value || typeof value !== "object") throw new Error("JSON 根节点必须是对象");
  const definition = value as WorkflowDefinition;
  if (definition.schemaVersion !== 1 || !Array.isArray(definition.nodes) || !Array.isArray(definition.edges)) {
    throw new Error("工作流 JSON 版本或结构无效");
  }
  if (!definition.nodes.length) throw new Error("工作流不能为空");
  const ids = new Set<string>();
  for (const node of definition.nodes) {
    if (!node?.id || ids.has(node.id)) throw new Error("节点 ID 缺失或重复");
    if (!getNodeDefinition(node.data?.kind)) throw new Error(`不支持的节点类型：${node.data?.kind ?? "未知"}`);
    if (!node.position || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      throw new Error(`节点 ${node.id} 的位置无效`);
    }
    ids.add(node.id);
  }
  const indegree = new Map([...ids].map((id) => [id, 0]));
  const outgoing = new Map([...ids].map((id) => [id, [] as string[]]));
  for (const edge of definition.edges) {
    if (!edge?.id || !ids.has(edge.source) || !ids.has(edge.target)) throw new Error("连线引用了不存在的节点");
    const source = definition.nodes.find((node) => node.id === edge.source)!;
    const target = definition.nodes.find((node) => node.id === edge.target)!;
    const sourcePort = getNodeDefinition(source.data.kind)?.outputs.find((port) => port.id === edge.sourceHandle);
    const targetPort = getNodeDefinition(target.data.kind)?.inputs.find((port) => port.id === edge.targetHandle);
    if (!sourcePort || !targetPort || sourcePort.type !== targetPort.type) throw new Error("连线端口无效或类型不兼容");
    indegree.set(edge.target, indegree.get(edge.target)! + 1);
    outgoing.get(edge.source)!.push(edge.target);
  }
  const queue = [...ids].filter((id) => indegree.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const current = queue.shift()!;
    visited += 1;
    for (const target of outgoing.get(current)!) {
      indegree.set(target, indegree.get(target)! - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  if (visited !== ids.size) throw new Error("工作流存在环路");
  return definition;
}

function localInputCount(
  config: Record<string, unknown>,
  port: Pick<WorkflowPort, "id" | "type">,
) {
  const value = config[port.id];
  if (port.type === "text") return typeof value === "string" && value.trim() ? 1 : 0;
  if (port.id === "images") return Array.isArray(config.images) ? config.images.length : 0;
  return config.media ? 1 : 0;
}

/** 在提交执行前给出节点级友好错误；后端会再次执行同等校验。 */
export function validateWorkflowForExecution(definition: WorkflowDefinition) {
  const issues: WorkflowValidationIssue[] = [];
  if (!definition.nodes.length) return [{ nodeId: "", message: "工作流不能为空" }];

  for (const node of definition.nodes) {
    const catalog = getNodeDefinition(node.data.kind);
    if (!catalog) {
      issues.push({ nodeId: node.id, message: `不支持的节点类型：${node.data.kind}` });
      continue;
    }
    if (node.data.kind === "input.text" && !String(node.data.config.text ?? "").trim()) {
      issues.push({ nodeId: node.id, portId: "text", message: "文本输入不能为空" });
    }
    if (
      ["input.image", "input.audio", "input.video"].includes(node.data.kind) &&
      !node.data.config.media
    ) {
      issues.push({ nodeId: node.id, message: `${catalog.label}尚未上传文件` });
    }
    if (node.data.kind.startsWith("ai.") && !String(node.data.config.model ?? "").trim()) {
      issues.push({ nodeId: node.id, message: "尚未选择 AI 模型" });
    }

    if (node.data.kind === "ai.multimodal-to-text") {
      const localText = localInputCount(node.data.config, { id: "text", type: "text" });
      const localImages = localInputCount(node.data.config, { id: "images", type: "image" });
      const connected = definition.edges.filter((edge) => edge.target === node.id).length;
      if (!localText && !localImages && !connected) {
        issues.push({ nodeId: node.id, message: "多模态转文本至少需要文本或图片" });
      }
    }

    for (const port of catalog.inputs.filter((item) => item.required)) {
      const connected = definition.edges.filter(
        (edge) => edge.target === node.id && edge.targetHandle === port.id,
      ).length;
      const count = connected + localInputCount(node.data.config, port);
      const minimum = node.data.kind === "ai.multi-image-to-image" && port.id === "images" ? 2 : 1;
      if (count < minimum) {
        issues.push({
          nodeId: node.id,
          portId: port.id,
          message: minimum > 1 ? `${port.label}至少需要 ${minimum} 张图片` : `缺少${port.label}`,
        });
      }
    }
  }
  return issues;
}
