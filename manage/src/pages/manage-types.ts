/** 运营后台支持的一级页面。 */
export type ManageSection = "overview" | "users" | "runs" | "payments" | "models" | "packages";

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
  name: string;
  provider: string;
  capabilities: string[];
  capabilityKeys: Record<string, number>;
  active: boolean;
  updatedAt?: string;
}

export interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
