/** 运营后台支持的一级页面。 */
export type ManageSection =
  "overview" | "users" | "runs" | "payments" | "assets" | "categories" | "models" | "packages";

export interface OverviewData {
  metrics: {
    users: number;
    todayUsers: number;
    workflows: number;
    runs: number;
    successRate: number;
    revenueFen: number;
    paidOrders: number;
  };
  trend: Array<{
    date: string;
    label: string;
    users: number;
    runs: number;
    successfulRuns: number;
    revenueFen: number;
  }>;
}

export interface ManageUser {
  id: string;
  nickname: string;
  phone: string;
  roles: Array<"CREATOR" | "MERCHANT">;
  createdAt: string;
  pointAccount?: { balance: number; frozen: number };
  _count: { workflows: number; runs: number; payments: number };
}

export interface ManageRun {
  id: string;
  status: string;
  cost: number;
  error?: string;
  createdAt: string;
  finishedAt?: string;
  user: { id: string; nickname: string; phone: string };
  workflow: { id: string; name: string };
  _count: { nodeRuns: number };
}

export interface ManagePayment {
  id: string;
  orderNo: string;
  status: string;
  channel: string;
  amountFen: number;
  keys: number;
  paidAt?: string;
  createdAt: string;
  user: { id: string; nickname: string; phone: string };
}

export interface RechargePackage {
  id: string;
  code: string;
  name: string;
  keys: number;
  amountFen: number;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface ManageModel {
  id: string;
  providerModelId: string;
  name: string;
  vendor: string;
  capability: string;
  description?: string;
  baseKeys: number;
  fields: ManageModelField[];
  pricingRules: Array<{
    field: string;
    operator: "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN";
    value: unknown;
    keys: number;
  }>;
  active: boolean;
  updatedAt: string;
}

export interface ManageModelField {
  key: string;
  type: string;
  required: boolean;
  default?: unknown;
  range?: string;
  description?: string;
  options?: Array<{
    label: string;
    value: string | number | boolean;
    keysMode: "NONE" | "SET" | "ADD";
    keysValue: number;
  }>;
}

export interface ModelInvocation {
  id: string;
  status: string;
  providerTaskUuid?: string;
  requestParams: Record<string, unknown>;
  pricingSnapshot: Record<string, unknown>;
  estimatedKeys: number;
  chargedKeys: number;
  refundedKeys: number;
  providerAmountUsd?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  model: Pick<ManageModel, "providerModelId" | "name" | "vendor" | "capability">;
  user?: { id: string; nickname: string; phone: string };
}

export interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ManageAssetStatus = "DRAFT" | "ACTIVE" | "DISABLED";
export interface ManageAssetFile {
  id: string;
  name: string;
  type: "image" | "audio" | "video";
  mimeType: string;
  size: number;
  url: string;
}
export interface ManageProductAsset {
  id: string;
  title: string;
  status: ManageAssetStatus;
  updatedAt: string;
  owner: { id: string; nickname: string; phone: string };
  category: { id: string; name: string };
  images: Array<{ file: ManageAssetFile }>;
}
export interface ManageCharacterAsset {
  id: string;
  name: string;
  status: ManageAssetStatus;
  source: string;
  voiceName?: string;
  isDefault: boolean;
  updatedAt: string;
  owner: { id: string; nickname: string; phone: string };
  images: Array<{ file: ManageAssetFile }>;
}

export interface ManageProductCategory {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId?: string;
  sortOrder: number;
  active: boolean;
  _count: { products: number };
  children: ManageProductCategory[];
}
