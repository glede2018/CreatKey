import type { NodeProps } from "@xyflow/react";
import { ConfigurableNode } from "./shared/configurable-node";
import { workflowNodeRegistry } from "./node-registry";
import type { WorkflowNodeData } from "@/types";

/** React Flow 的统一入口；具体节点实现由 kind 注册到独立组件。 */
export function WorkflowNode({ id, data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const NodeComponent = workflowNodeRegistry[nodeData.kind] ?? ConfigurableNode;

  return <NodeComponent id={id} data={nodeData} selected={selected} />;
}

