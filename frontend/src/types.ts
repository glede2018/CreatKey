import type { Edge, Node } from "@xyflow/react";

export type Role = "CREATOR" | "MERCHANT";
export interface User {
  id: string;
  nickname: string;
  avatarUrl?: string;
  roles: Role[];
  points: number;
}
export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  config: Record<string, unknown>;
  status?: string;
}
export interface WorkflowDefinition {
  schemaVersion: 1;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  definition: WorkflowDefinition;
  updatedAt: string;
}
export interface RunNode {
  id: string;
  nodeKey: string;
  status: string;
  output?: unknown;
  error?: string;
}
export interface WorkflowRun {
  id: string;
  status: string;
  cost: number;
  createdAt: string;
  nodeRuns: RunNode[];
}
