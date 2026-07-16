import type { Edge, Node } from "@xyflow/react";

export type Role = "CREATOR" | "MERCHANT";
export interface User {
  id: string;
  nickname: string;
  avatarUrl?: string;
  roles: Role[];
  profileInitialized: boolean;
  phone: string;
  keys: number;
}
export interface RechargePackage {
  id: string;
  name: string;
  keys: number;
  amountFen: number;
}
export interface PaymentOrder {
  id: string;
  status: "PENDING" | "PAID" | "CLOSED";
  keys: number;
  amountFen: number;
  qrImage: string;
  mock: boolean;
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
