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
  kind: string;
  label: string;
  description?: string;
  inputs?: WorkflowPort[];
  outputs?: WorkflowPort[];
  config: Record<string, unknown>;
  status?: string;
  run?: RunNode;
  locked?: boolean;
  validationError?: string;
  connectedInputs?: Record<string, ConnectedInputPreview[]>;
}
export type WorkflowDataType = "text" | "image" | "audio" | "video";
export interface WorkflowPort {
  id: string;
  label: string;
  type: WorkflowDataType;
  required?: boolean;
  multiple?: boolean;
}
export interface MediaAsset {
  id: string;
  name: string;
  type: "image" | "audio" | "video";
  mimeType: string;
  size: number;
  url: string;
}
export type AssetStatus = "DRAFT" | "ACTIVE" | "DISABLED";
export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId?: string;
  children: ProductCategory[];
}
export interface ProductAsset {
  id: string;
  title: string;
  categoryId: string;
  category: ProductCategory;
  sellingPoints: string[];
  audienceProfile?: string;
  description?: string;
  sourceUrl?: string;
  tags: string[];
  status: AssetStatus;
  updatedAt: string;
  images: Array<{ id: string; role: "COVER" | "DETAIL" | "REFERENCE"; file: MediaAsset }>;
}
export interface CharacterAsset {
  id: string;
  name: string;
  referenceFile?: MediaAsset;
  description?: string;
  generationPrompt?: string;
  modelId?: string;
  voiceId?: string;
  voiceName?: string;
  tags: string[];
  source: "UPLOAD" | "AI_GENERATED" | "REMOTE_IMPORT";
  isDefault: boolean;
  status: AssetStatus;
  updatedAt: string;
  images: Array<{ id: string; angle: string; file: MediaAsset }>;
}
export interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ConnectedInputPreview {
  edgeId: string;
  sourceNodeId: string;
  sourceLabel: string;
  type: WorkflowDataType;
  asset?: MediaAsset;
  text?: string;
}
export interface ModelField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | "textarea";
  default?: string | number | boolean;
  required?: boolean;
  description?: string;
  range?: string;
  options?: Array<{
    label: string;
    value: string | number | boolean;
    keysMode?: "NONE" | "SET" | "ADD";
    keysValue?: number;
  }>;
  min?: number;
  max?: number;
  step?: number;
}
export interface AiModelDefinition {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  capabilityKeys: Record<string, number>;
  fields: ModelField[];
  pricingRules?: Array<{
    field: string;
    operator: "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN";
    value: unknown;
    keys: number;
  }>;
}
export interface AiCatalog {
  models: AiModelDefinition[];
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
  activeRunId?: string;
  lockedAt?: string;
  updatedAt: string;
}
export interface RunNode {
  id: string;
  nodeKey: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  errorDetails?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}
export interface WorkflowRun {
  id: string;
  status: string;
  cost: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  createdAt: string;
  nodeRuns: RunNode[];
}
