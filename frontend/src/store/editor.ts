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
import { getNodeDefinition, hydrateNodeData } from "@/lib/workflow-catalog";
import type { WorkflowDefinition, WorkflowNodeData } from "@/types";
import type { Edge, Node } from "@xyflow/react";

const legacyKinds: Record<string, string> = {
  提示词: "input.text",
  提示词优化: "transform.template",
  图像生成: "image.generate",
};

function normalizeNode(node: Node<WorkflowNodeData>) {
  const kind = node.data.kind ?? String(node.data.config?.kind ?? legacyKinds[node.data.label] ?? "");
  const definition = getNodeDefinition(kind);
  return {
    ...node,
    data: {
      ...node.data,
      kind,
      inputs: node.data.inputs ?? definition?.inputs ?? [],
      outputs: node.data.outputs ?? definition?.outputs ?? [],
    },
  };
}

interface EditorState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  viewport: Viewport;
  selectedId?: string;
  locked: boolean;
  setNodes: (nodes: Node<WorkflowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: Viewport) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  canConnect: (connection: Connection | Edge) => boolean;
  setLocked: (locked: boolean) => void;
  select: (id?: string) => void;
  updateConfig: (id: string, key: string, value: unknown) => void;
  updateConfigs: (id: string, values: Record<string, unknown>) => void;
  addNode: (kind: string) => void;
  pasteNode: (node: Node<WorkflowNodeData>, anchorId: string) => string;
  deleteNode: (id: string) => void;
  deleteEdge: (id: string) => void;
  load: (definition: WorkflowDefinition) => void;
  export: () => WorkflowDefinition;
}

/** 管理工作流画布，并在创建连线前执行端口类型、数量、重复与环路校验。 */
export const useEditor = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  locked: false,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setViewport: (viewport) => set({ viewport }),
  onNodesChange: (changes) => {
    const allowed = get().locked
      ? changes.filter((change) => change.type === "select" || change.type === "dimensions")
      : changes;
    set({ nodes: applyNodeChanges(allowed, get().nodes) as Node<WorkflowNodeData>[] });
  },
  onEdgesChange: (changes) => {
    const allowed = get().locked ? changes.filter((change) => change.type === "select") : changes;
    set({ edges: applyEdgeChanges(allowed, get().edges) });
  },
  canConnect: (connection) => {
    if (get().locked) return false;
    if (!connection.source || !connection.target || connection.source === connection.target) return false;
    const source = get().nodes.find((node) => node.id === connection.source);
    const target = get().nodes.find((node) => node.id === connection.target);
    if (!source || !target) return false;
    const sourcePort = source.data.outputs?.find((port) => port.id === connection.sourceHandle);
    const targetPort = target.data.inputs?.find((port) => port.id === connection.targetHandle);
    if (!sourcePort || !targetPort || sourcePort.type !== targetPort.type) return false;
    if (
      get().edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.sourceHandle === connection.sourceHandle &&
          edge.targetHandle === connection.targetHandle,
      )
    )
      return false;
    if (
      !targetPort.multiple &&
      get().edges.some(
        (edge) => edge.target === connection.target && edge.targetHandle === connection.targetHandle,
      )
    )
      return false;
    const visited = new Set<string>();
    const queue = [connection.target];
    while (queue.length) {
      const current = queue.shift()!;
      if (current === connection.source) return false;
      if (visited.has(current)) continue;
      visited.add(current);
      get().edges.filter((edge) => edge.source === current).forEach((edge) => queue.push(edge.target));
    }
    return true;
  },
  onConnect: (connection) => {
    if (get().locked) return;
    if (!get().canConnect(connection)) return;
    const source = get().nodes.find((node) => node.id === connection.source);
    const sourceType = source?.data.outputs?.find((port) => port.id === connection.sourceHandle)?.type;
    const stroke = {
      text: "#8b7cf6",
      image: "#4f8cff",
      audio: "#22c58b",
      video: "#f59e57",
    }[sourceType ?? "text"];
    set({
      edges: addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke, strokeWidth: 1.7 },
        },
        get().edges,
      ),
    });
  },
  setLocked: (locked) => set({ locked }),
  select: (selectedId) => set({ selectedId }),
  updateConfig: (id, key, value) =>
    !get().locked && set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, config: { ...node.data.config, [key]: value } } }
          : node,
      ),
    }),
  updateConfigs: (id, values) =>
    !get().locked && set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, config: { ...node.data.config, ...values } } }
          : node,
      ),
    }),
  addNode: (kind) =>
    !get().locked && set({
      nodes: [
        ...get().nodes,
        {
          id: `${kind}-${crypto.randomUUID().slice(0, 8)}`,
          type: "workflow",
          position: { x: 260 + Math.random() * 360, y: 110 + Math.random() * 300 },
          data: hydrateNodeData(kind),
        },
      ],
    }),
  pasteNode: (node, anchorId) => {
    if (get().locked) return node.id;
    const anchor = get().nodes.find((item) => item.id === anchorId);
    const id = `${node.data.kind}-${crypto.randomUUID().slice(0, 8)}`;
    const position = anchor
      ? { x: anchor.position.x + 32, y: anchor.position.y + 32 }
      : { x: node.position.x + 32, y: node.position.y + 32 };
    set({
      nodes: [
        ...get().nodes.map((item) => ({ ...item, selected: false })),
        {
          ...node,
          id,
          position,
          selected: true,
          data: structuredClone(node.data),
        },
      ],
      selectedId: id,
    });
    return id;
  },
  deleteNode: (id) =>
    !get().locked && set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
      selectedId: get().selectedId === id ? undefined : get().selectedId,
    }),
  deleteEdge: (id) => {
    if (!get().locked) set({ edges: get().edges.filter((edge) => edge.id !== id) });
  },
  load: (definition) =>
    set({
      nodes: definition.nodes.map((node) => normalizeNode(node)),
      edges: definition.edges,
      viewport: definition.viewport ?? { x: 0, y: 0, zoom: 1 },
      selectedId: undefined,
    }),
  export: () => ({
    schemaVersion: 1,
    nodes: get().nodes,
    edges: get().edges,
    viewport: get().viewport,
  }),
}));
