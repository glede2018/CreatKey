import { z } from "zod";
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
          description: z.string().optional(),
          config: z.record(z.string(), z.unknown()),
        }),
      }),
    )
    .min(1)
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
