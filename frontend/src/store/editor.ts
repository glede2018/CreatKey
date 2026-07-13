import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import { create } from "zustand";
import type { WorkflowDefinition, WorkflowNodeData } from "@/types";
import type { Edge, Node } from "@xyflow/react";

const initialNodes: Node<WorkflowNodeData>[] = [
  {
    id: "prompt",
    type: "workflow",
    position: { x: 120, y: 180 },
    data: {
      label: "提示词",
      description: "输入创意描述",
      config: { text: "未来主义香水广告，黑色背景，电影光效" },
    },
  },
  {
    id: "enhance",
    type: "workflow",
    position: { x: 440, y: 180 },
    data: {
      label: "提示词优化",
      description: "让描述更适合图像模型",
      config: { template: "{{input}}，商业摄影，8K" },
    },
  },
  {
    id: "image",
    type: "workflow",
    position: { x: 760, y: 180 },
    data: {
      label: "图像生成",
      description: "生成最终视觉资产",
      config: { ratio: "1:1", count: 1 },
    },
  },
];
const initialEdges: Edge[] = [
  { id: "prompt-enhance", source: "prompt", target: "enhance", animated: true },
  { id: "enhance-image", source: "enhance", target: "image", animated: true },
];

interface EditorState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  viewport: Viewport;
  selectedId?: string;
  /** 整体替换节点集合。 */
  setNodes: (nodes: Node<WorkflowNodeData>[]) => void;
  /** 整体替换连线集合。 */
  setEdges: (edges: Edge[]) => void;
  /** 应用 React Flow 产生的节点变更。 */
  onNodesChange: (changes: NodeChange[]) => void;
  /** 应用 React Flow 产生的连线变更。 */
  onEdgesChange: (changes: EdgeChange[]) => void;
  /** 创建一条新的有向连线。 */
  onConnect: (connection: Connection) => void;
  /** 记录当前选中的节点。 */
  select: (id?: string) => void;
  /** 更新节点配置中的单个字段。 */
  updateConfig: (id: string, key: string, value: unknown) => void;
  /** 按节点类型在画布中加入新节点。 */
  addNode: (kind: string, label: string) => void;
  /** 从后端或 JSON 文件载入完整工作流。 */
  load: (definition: WorkflowDefinition) => void;
  /** 导出可持久化的工作流定义。 */
  export: () => WorkflowDefinition;
}

/** 管理工作流画布的节点、连线、选择和导入导出状态。 */
export const useEditor = create<EditorState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  viewport: { x: 0, y: 0, zoom: 1 },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) as Node<WorkflowNodeData>[] }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) =>
    set({ edges: addEdge({ ...connection, animated: true }, get().edges) }),
  select: (selectedId) => set({ selectedId }),
  updateConfig: (id, key, value) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, config: { ...node.data.config, [key]: value } } }
          : node,
      ),
    }),
  addNode: (kind, label) =>
    set({
      nodes: [
        ...get().nodes,
        {
          id: `${kind}-${crypto.randomUUID().slice(0, 8)}`,
          type: "workflow",
          position: { x: 280 + Math.random() * 300, y: 120 + Math.random() * 260 },
          data: { label, description: "配置节点参数", config: { kind } },
        },
      ],
    }),
  load: (definition) =>
    set({
      nodes: definition.nodes,
      edges: definition.edges,
      viewport: definition.viewport ?? { x: 0, y: 0, zoom: 1 },
    }),
  export: () => ({
    schemaVersion: 1,
    nodes: get().nodes,
    edges: get().edges,
    viewport: get().viewport,
  }),
}));
