import { z } from "zod";
import { nodeDefinition } from "./node-catalog";
export const workflowDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        type: z.string().optional(),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.object({
          label: z.string(),
          kind: z.string().optional(),
          description: z.string().optional(),
          config: z.record(z.string(), z.unknown()),
        }),
      }),
    )
    .max(200),
  edges: z
    .array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().nullable().optional(),
        targetHandle: z.string().nullable().optional(),
        animated: z.boolean().optional(),
      }),
    )
    .max(500),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

export interface WorkflowValidationIssue {
  nodeId: string;
  portId?: string;
  message: string;
}

function nodeKind(node: WorkflowDefinition["nodes"][number]) {
  return node.data.kind ?? String(node.data.config.kind ?? "");
}

/** 返回目标节点及其全部上游依赖；未指定目标时返回完整工作流。 */
export function executionDefinition(
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

function localInputCount(
  node: WorkflowDefinition["nodes"][number],
  port: { id: string; type: string },
) {
  const value = node.data.config[port.id];
  if (port.type === "text") return typeof value === "string" && value.trim() ? 1 : 0;
  if (port.id === "images") {
    return Array.isArray(node.data.config.images) ? node.data.config.images.length : 0;
  }
  return node.data.config.media ? 1 : 0;
}

/** 收集执行前的业务校验问题；合法连线可以满足下游节点的必填输入。 */
export function collectExecutionIssues(definition: WorkflowDefinition): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  if (!definition.nodes.length) {
    return [{ nodeId: "", message: "工作流不能为空" }];
  }
  for (const node of definition.nodes) {
    const kind = nodeKind(node);
    const catalog = nodeDefinition(kind);
    if (!catalog) {
      issues.push({ nodeId: node.id, message: `不支持的节点类型：${kind || "未知"}` });
      continue;
    }
    if (kind === "input.text" && !String(node.data.config.text ?? "").trim()) {
      issues.push({ nodeId: node.id, portId: "text", message: "文本输入不能为空" });
    }
    if (["input.image", "input.audio", "input.video"].includes(kind) && !node.data.config.media) {
      issues.push({ nodeId: node.id, message: `${catalog.label}尚未上传文件` });
    }
    if (kind.startsWith("ai.") && !String(node.data.config.model ?? "").trim()) {
      issues.push({ nodeId: node.id, message: "尚未选择 AI 模型" });
    }

    if (kind === "ai.multimodal-to-text") {
      const textCount = localInputCount(node, { id: "text", type: "text" })
        + definition.edges.filter((edge) => edge.target === node.id && edge.targetHandle === "text").length;
      const imageCount = localInputCount(node, { id: "images", type: "image" })
        + definition.edges.filter((edge) => edge.target === node.id && edge.targetHandle === "images").length;
      if (!textCount && !imageCount) {
        issues.push({ nodeId: node.id, message: "多模态转文本至少需要文本或图片" });
      }
    }

    for (const port of catalog.inputs.filter((item) => item.required)) {
      const edgeCount = definition.edges.filter(
        (edge) => edge.target === node.id && edge.targetHandle === port.id,
      ).length;
      const count = edgeCount + localInputCount(node, port);
      const minimum = kind === "ai.multi-image-to-image" && port.id === "images" ? 2 : 1;
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

/** 使用拓扑排序校验节点引用、节点 ID 唯一性以及 DAG 无环约束。 */
export function validateDag(definition: WorkflowDefinition) {
  const ids = new Set(definition.nodes.map((node) => node.id));
  if (ids.size !== definition.nodes.length) throw new Error("节点 ID 重复");
  const indegree = new Map([...ids].map((id) => [id, 0]));
  const outgoing = new Map([...ids].map((id) => [id, [] as string[]]));
  for (const edge of definition.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error("连线引用了不存在的节点");
    indegree.set(edge.target, indegree.get(edge.target)! + 1);
    outgoing.get(edge.source)!.push(edge.target);

    const sourceNode = definition.nodes.find((node) => node.id === edge.source)!;
    const targetNode = definition.nodes.find((node) => node.id === edge.target)!;
    const sourceKind = sourceNode.data.kind ?? String(sourceNode.data.config.kind ?? "");
    const targetKind = targetNode.data.kind ?? String(targetNode.data.config.kind ?? "");
    const sourceDefinition = nodeDefinition(sourceKind);
    const targetDefinition = nodeDefinition(targetKind);
    if (sourceDefinition && targetDefinition) {
      const sourcePort = sourceDefinition.outputs.find((port) => port.id === edge.sourceHandle);
      const targetPort = targetDefinition.inputs.find((port) => port.id === edge.targetHandle);
      if (!sourcePort || !targetPort) throw new Error("连线端口不存在");
      if (sourcePort.type !== targetPort.type) throw new Error("连线端口类型不兼容");
      if (!targetPort.multiple) {
        const duplicates = definition.edges.filter(
          (item) => item.target === edge.target && item.targetHandle === edge.targetHandle,
        );
        if (duplicates.length > 1) throw new Error("该输入端口只允许一条连线");
      }
    }
  }
  const queue = [...ids].filter((id) => indegree.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    for (const next of outgoing.get(id)!) {
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (visited !== ids.size) throw new Error("工作流存在环路，只允许 DAG");
}
