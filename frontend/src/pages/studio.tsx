import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  Bell,
  ChevronDown,
  Coins,
  Copy,
  Download,
  FileAudio,
  FileJson2,
  FileVideo,
  FlaskConical,
  History,
  Home,
  Image,
  LayoutGrid,
  LockKeyhole,
  Loader2,
  LogOut,
  Play,
  Plus,
  Save,
  Sparkles,
  ClipboardPaste,
  Trash2,
  Type,
  Upload,
  UserRound,
  WandSparkles,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioSidebar, type StudioSection } from "@/components/studio-sidebar";
import { AssetsPage } from "@/pages/assets";
import { HomePage } from "@/pages/home";
import { PricingPage } from "@/pages/pricing";
import { ProfilePage } from "@/pages/profile";
import { WorkflowsPage } from "@/pages/workflows";
import { WorkflowNode } from "@/components/workflow-nodes/workflow-node";
import { api } from "@/lib/api";
import { useEditor } from "@/store/editor";
import { nodeExecutionKeys, workflowNodeCatalog } from "@/lib/workflow-catalog";
import {
  parseImportedWorkflow,
  validateWorkflowForExecution,
  workflowExecutionDefinition,
} from "@/lib/workflow-validation";
import type {
  AiCatalog,
  ConnectedInputPreview,
  MediaAsset,
  ModelField,
  RunNode,
  User,
  Workflow,
  WorkflowDataType,
  WorkflowDefinition,
  WorkflowNodeData,
  WorkflowRun,
} from "@/types";
import type { Edge, Node } from "@xyflow/react";

const nodeTypes = { workflow: WorkflowNode };
const emptyWorkflow: WorkflowDefinition = { schemaVersion: 1, nodes: [], edges: [] };

const nodeIcons: Record<string, typeof Type> = {
  "input.text": Type,
  "input.image": Image,
  "input.audio": FileAudio,
  "input.video": FileVideo,
  "ai.speech-to-text": FileAudio,
  "ai.multimodal-to-text": Sparkles,
  "ai.image-to-image": Image,
  "ai.multi-image-to-image": Image,
  "ai.text-to-image": WandSparkles,
  "ai.music-generation": FileAudio,
  "ai.text-to-speech": FileAudio,
  "ai.text-to-video": FileVideo,
  "ai.image-to-video": FileVideo,
};
const inputNodes = workflowNodeCatalog.filter((node) => node.category === "input");
const aiGroups = ["text", "image", "audio", "video"].map((category) => ({
  category,
  label: ({ text: "文本", image: "图片", audio: "音频", video: "视频" } as Record<string, string>)[
    category
  ],
  nodes: workflowNodeCatalog.filter((node) => node.category === category),
}));

function portBadgeLabel(type: WorkflowDataType, multiple?: boolean) {
  const label = { text: "文", image: "图", audio: "音", video: "视" }[type];
  return multiple ? `多${label}` : label;
}

type NodeContextMenuState = { nodeId: string; x: number; y: number };
const terminalRunStatuses = ["SUCCEEDED", "FAILED", "CANCELED"];

function outputPreview(
  source: Node<WorkflowNodeData>,
  sourceRun: RunNode | undefined,
  edge: Edge,
): ConnectedInputPreview {
  const output = sourceRun?.output;
  const record =
    output && typeof output === "object" ? (output as Record<string, unknown>) : undefined;
  const rawAsset = Array.isArray(record?.assets)
    ? record.assets[0]
    : record?.artifact && typeof record.artifact === "object"
      ? record.artifact
      : source.data.config.media;
  const outputPort = source.data.outputs?.find((port) => port.id === edge.sourceHandle);
  const type = outputPort?.type ?? "text";
  let asset: MediaAsset | undefined;
  if (
    rawAsset &&
    typeof rawAsset === "object" &&
    typeof (rawAsset as { url?: unknown }).url === "string"
  ) {
    const value = rawAsset as Partial<MediaAsset> & { url: string };
    asset = {
      id: value.id ?? value.url,
      name: value.name ?? source.data.label,
      type: type === "text" ? "image" : type,
      mimeType: value.mimeType ?? `${type}/*`,
      size: value.size ?? 0,
      url: value.url,
    };
  }
  const text =
    source.data.kind === "input.text"
      ? String(source.data.config.text ?? "")
      : typeof record?.value === "string"
        ? record.value
        : typeof record?.text === "string"
          ? record.text
          : undefined;
  return {
    edgeId: edge.id,
    sourceNodeId: source.id,
    sourceLabel: source.data.label,
    type: type as WorkflowDataType,
    asset,
    text,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string, fallback = "节点产物") {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || fallback;
}

function workflowExportTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function downloadNodeOutput(node: Node<WorkflowNodeData>, nodeRun?: RunNode) {
  if (nodeRun?.output === undefined) {
    toast.info("该模块暂无可下载产物");
    return;
  }
  const output = nodeRun.output;
  const record =
    output && typeof output === "object" ? (output as Record<string, unknown>) : undefined;
  const assets = Array.isArray(record?.assets)
    ? record.assets.filter((item): item is { url: string; name?: string } =>
        Boolean(
          item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string",
        ),
      )
    : [];
  const artifact =
    record?.artifact && typeof record.artifact === "object"
      ? (record.artifact as { url?: unknown; name?: unknown })
      : undefined;
  const downloads = assets.length
    ? assets
    : typeof artifact?.url === "string"
      ? [{ url: artifact.url, name: typeof artifact.name === "string" ? artifact.name : undefined }]
      : [];

  if (downloads.length) {
    for (const [index, item] of downloads.entries()) {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error(`产物下载失败（${response.status}）`);
      const extension = item.url.split("?")[0].split(".").pop();
      const fallback = `${safeFilename(node.data.label)}${downloads.length > 1 ? `-${index + 1}` : ""}${extension ? `.${extension}` : ""}`;
      downloadBlob(await response.blob(), item.name || fallback);
    }
    toast.success(downloads.length > 1 ? `已下载 ${downloads.length} 个产物` : "产物已下载");
    return;
  }

  const textValue =
    typeof output === "string"
      ? output
      : typeof record?.value === "string"
        ? record.value
        : undefined;
  if (textValue !== undefined) {
    downloadBlob(
      new Blob([textValue], { type: "text/plain;charset=utf-8" }),
      `${safeFilename(node.data.label)}.txt`,
    );
  } else {
    downloadBlob(
      new Blob([JSON.stringify(output, null, 2)], { type: "application/json" }),
      `${safeFilename(node.data.label)}.json`,
    );
  }
  toast.success("产物已下载");
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative block size-6">
        <i className="ck-brand-dot-primary absolute left-1 top-1 size-1 rounded-sm" />
        <i className="ck-brand-dot-secondary absolute bottom-1 right-1 size-1 rounded-sm" />
      </span>
      <span className="ck-brand">CREATKEY</span>
    </div>
  );
}

function ModelFieldControl({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: ModelField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const keysLabel = (option?: NonNullable<ModelField["options"]>[number]) => {
    const keys = Number(option?.keysValue ?? 0);
    if (option?.keysMode === "SET") return `${keys} Keys`;
    if (option?.keysMode === "ADD") return `+${keys} Keys`;
    return "";
  };
  const selectedOption = field.options?.find((item) => item.value === value);
  const help = field.description || field.range;

  return (
    <label className="block">
      <span className="ck-editor-field-label mb-1.5 block">
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-400">*</span> : null}
      </span>
      {field.type === "select" ? (
        <select
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => {
            const option = field.options?.find((item) => String(item.value) === event.target.value);
            onChange(option?.value ?? event.target.value);
          }}
          className="ck-editor-input h-10 w-full rounded-md border px-3 text-xs"
        >
          {field.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
              {keysLabel(option) ? ` · ${keysLabel(option)}` : ""}
            </option>
          ))}
        </select>
      ) : field.type === "boolean" ? (
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          disabled={disabled}
          onClick={() => onChange(!Boolean(value))}
          className={`flex h-9 w-full items-center justify-between rounded-md border px-3 text-xs ${value ? "ck-field-enabled" : ""}`}
        >
          <span>{value ? "已开启" : "已关闭"}</span>
          <span
            className={`h-4 w-7 rounded-full p-0.5 ${value ? "ck-switch-on" : "ck-switch-off"}`}
          >
            <i
              className={`block size-3 rounded-full bg-white transition ${value ? "translate-x-3" : ""}`}
            />
          </span>
        </button>
      ) : field.type === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="ck-editor-input min-h-20 w-full resize-y rounded-md border p-3 text-xs outline-none"
        />
      ) : (
        <Input
          type={field.type === "number" ? "number" : "text"}
          min={field.min}
          max={field.max}
          step={field.step}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) =>
            onChange(field.type === "number" ? Number(event.target.value) : event.target.value)
          }
          className="ck-editor-input"
        />
      )}
      {(help || (field.type === "boolean" && keysLabel(selectedOption))) && (
        <span className="ck-text-faint mt-1 block text-[10px]">
          {[help, field.type === "boolean" ? keysLabel(selectedOption) : ""]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </label>
  );
}

function AvatarMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <div className="group relative shrink-0">
      <button
        className="ck-avatar ck-type-12 ck-medium grid size-9 place-items-center rounded-full"
        aria-label="打开账户菜单"
        aria-haspopup="menu"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="size-full rounded-full object-cover" />
        ) : (
          user.nickname.slice(0, 1)
        )}
      </button>
      <div className="invisible absolute right-0 top-full z-50 w-32 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="ck-menu rounded-lg border p-1 text-left" role="menu">
          <button
            onClick={onLogout}
            className="ck-menu-item flex w-full items-center gap-2 rounded-md px-3 py-2"
            role="menuitem"
          >
            <LogOut size={13} /> 退出登录
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  user,
  onLogout,
  onUserRefresh,
  activeSection,
  onNavigate,
}: {
  user: User;
  onLogout: () => void;
  onUserRefresh: () => void;
  activeSection: StudioSection;
  onNavigate: (section: StudioSection) => void;
}) {
  return (
    <div className="ck-app flex h-screen flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-5">
          <Brand />
          <div className="ck-header-divider h-4 w-px" />
          <span className="ck-header-role">
            {user.roles.includes("MERCHANT") ? "商家" : "制作人"}
          </span>
          <button className="ck-header-select flex h-8 items-center gap-2 rounded-lg px-2">
            <UserRound size={15} /> 个人空间 <ChevronDown size={13} className="ck-text-muted" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("pricing")}
            className="ck-plan-button flex h-8 items-center gap-2 rounded-lg pl-3 pr-2"
          >
            专业版
            <span className="ck-plan-value flex items-center gap-1 rounded-md px-2 py-1">
              <Coins size={13} /> {user.keys} Keys
            </span>
          </button>
          <button className="ck-icon-button grid size-10 place-items-center rounded-lg">
            <Bell size={18} />
          </button>
          <AvatarMenu user={user} onLogout={onLogout} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <StudioSidebar activeSection={activeSection} onNavigate={onNavigate} />

        {activeSection === "pricing" ? (
          <PricingPage user={user} onPaid={onUserRefresh} />
        ) : activeSection === "workflows" ? (
          <WorkflowsPage />
        ) : activeSection === "assets" ? (
          <AssetsPage />
        ) : activeSection === "profile" ? (
          <ProfilePage />
        ) : (
          <HomePage />
        )}
      </div>
    </div>
  );
}

function EditorCanvas({
  user,
  initialWorkflow,
  onBack,
  onRecharge,
}: {
  user: User;
  initialWorkflow?: Workflow;
  onBack: () => void;
  onRecharge: () => void;
}) {
  const {
    nodes,
    edges,
    viewport,
    locked,
    selectedId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    canConnect,
    setViewport: storeViewport,
    setLocked,
    select,
    updateConfig,
    replaceConfig,
    addNode,
    pasteNode,
    deleteNode,
    load,
    export: exportFlow,
  } = useEditor();
  const { fitView, setViewport: applyViewport } = useReactFlow();
  const importRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [workflow, setWorkflow] = useState<Workflow | undefined>(initialWorkflow);
  const [name, setName] = useState(initialWorkflow?.name ?? "未命名");
  const [run, setRun] = useState<WorkflowRun>();
  const [saving, setSaving] = useState(false);
  const [toolMenu, setToolMenu] = useState<"input" | "ai" | undefined>();
  const [aiCategory, setAiCategory] = useState("text");
  const [catalog, setCatalog] = useState<AiCatalog>({ models: [] });
  const [copiedNode, setCopiedNode] = useState<Node<WorkflowNodeData>>();
  const [contextMenu, setContextMenu] = useState<NodeContextMenuState>();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [jsonMenuOpen, setJsonMenuOpen] = useState(false);
  const selected = nodes.find((node) => node.id === selectedId);
  const selectedIsInput = selected?.data.kind.startsWith("input.") ?? false;
  const selectedRun = run?.nodeRuns.find((node) => node.nodeKey === selectedId);
  const contextNode = nodes.find((node) => node.id === contextMenu?.nodeId);
  const contextNodeRun = run?.nodeRuns.find((node) => node.nodeKey === contextMenu?.nodeId);
  const activeStates = useMemo(
    () => Object.fromEntries((run?.nodeRuns ?? []).map((node) => [node.nodeKey, node.status])),
    [run],
  );
  const canvasKeys = useMemo(
    () =>
      nodes.reduce(
        (sum, node) =>
          sum +
          nodeExecutionKeys(
            node.data.kind,
            String(node.data.config.model ?? ""),
            catalog.models,
            node.data.config,
          ),
        0,
      ),
    [catalog.models, nodes],
  );
  const selectedExecutionKeys = useMemo(() => {
    if (!selectedId) return 0;
    const definition = workflowExecutionDefinition({ schemaVersion: 1, nodes, edges }, selectedId);
    return definition.nodes.reduce(
      (sum, node) =>
        sum +
        nodeExecutionKeys(
          node.data.kind,
          String(node.data.config.model ?? ""),
          catalog.models,
          node.data.config,
        ),
      0,
    );
  }, [catalog.models, edges, nodes, selectedId]);
  const displayNodes = useMemo(() => {
    const nodeRuns = new Map((run?.nodeRuns ?? []).map((item) => [item.nodeKey, item]));
    const nodeMap = new Map(nodes.map((item) => [item.id, item]));
    return nodes.map((node) => {
      const connectedInputs: Record<string, ConnectedInputPreview[]> = {};
      for (const edge of edges.filter((item) => item.target === node.id)) {
        const source = nodeMap.get(edge.source);
        if (!source || !edge.targetHandle) continue;
        const values = connectedInputs[edge.targetHandle] ?? [];
        values.push(outputPreview(source, nodeRuns.get(source.id), edge));
        connectedInputs[edge.targetHandle] = values;
      }
      return {
        ...node,
        data: {
          ...node.data,
          status: activeStates[node.id],
          run: nodeRuns.get(node.id),
          locked,
          validationError: validationErrors[node.id],
          connectedInputs,
        },
      };
    });
  }, [activeStates, edges, locked, nodes, run, validationErrors]);

  useEffect(() => {
    const definition = initialWorkflow?.definition ?? emptyWorkflow;
    load(definition);
    if (initialWorkflow?.activeRunId) {
      api<WorkflowRun>(`/runs/${initialWorkflow.activeRunId}`)
        .then(setRun)
        .catch(() => undefined);
    }
    const timer = window.setTimeout(() => {
      if (definition.viewport) void applyViewport(definition.viewport);
      else if (definition.nodes.length) fitView({ padding: 0.24 });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [applyViewport, fitView, initialWorkflow, load]);

  useEffect(() => {
    const active = run ? !terminalRunStatuses.includes(run.status) : Boolean(workflow?.activeRunId);
    setLocked(active);
    if (active) setToolMenu(undefined);
  }, [run, setLocked, workflow?.activeRunId]);

  useEffect(() => {
    let active = true;
    api<AiCatalog>("/ai/catalog")
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "模型目录加载失败");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!run || terminalRunStatuses.includes(run.status)) return;
    const timer = window.setInterval(
      () =>
        api<WorkflowRun>(`/runs/${run.id}`)
          .then((nextRun) => {
            setRun(nextRun);
            if (terminalRunStatuses.includes(nextRun.status)) {
              setWorkflow((current) =>
                current ? { ...current, activeRunId: undefined, lockedAt: undefined } : current,
              );
            }
          })
          .catch(() => undefined),
      1200,
    );
    return () => window.clearInterval(timer);
  }, [run]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(undefined);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    document.addEventListener("keydown", onKeyDown);
    contextMenuRef.current?.focus();
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  async function save() {
    if (locked) {
      toast.info("工作流运行中，暂时不能保存修改");
      return;
    }
    setSaving(true);
    try {
      const body = { name, definition: exportFlow() };
      const result = workflow
        ? await api<Workflow>(`/workflows/${workflow.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await api<Workflow>("/workflows", { method: "POST", body: JSON.stringify(body) });
      setWorkflow(result);
      toast.success("工作流已保存");
      return result;
    } finally {
      setSaving(false);
    }
  }

  async function execute(targetNodeId?: string) {
    const completeDefinition = exportFlow();
    const definition = workflowExecutionDefinition(completeDefinition, targetNodeId);
    const issues = validateWorkflowForExecution(definition);
    if (issues.length) {
      const errorsByNode: Record<string, string[]> = {};
      for (const issue of issues.filter((item) => item.nodeId)) {
        errorsByNode[issue.nodeId] = [...(errorsByNode[issue.nodeId] ?? []), issue.message];
      }
      setValidationErrors(
        Object.fromEntries(
          Object.entries(errorsByNode).map(([nodeId, messages]) => [nodeId, messages.join("；")]),
        ),
      );
      if (issues[0].nodeId) select(issues[0].nodeId);
      toast.error(issues[0].message);
      return;
    }
    setValidationErrors({});
    const current = await save();
    if (!current) return;
    try {
      const nextRun = await api<WorkflowRun>(`/workflows/${current.id}/runs`, {
        method: "POST",
        body: JSON.stringify(targetNodeId ? { nodeId: targetNodeId } : {}),
      });
      setRun(nextRun);
      setWorkflow({ ...current, activeRunId: nextRun.id, lockedAt: new Date().toISOString() });
      toast.success(targetNodeId ? "当前节点开始执行" : "工作流开始执行");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "执行失败");
    }
  }

  async function cancelExecution() {
    if (!run || terminalRunStatuses.includes(run.status)) return;
    try {
      setRun(await api<WorkflowRun>(`/runs/${run.id}/cancel`, { method: "POST" }));
      toast.success("工作流已取消");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取消失败");
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(exportFlow(), null, 2)], { type: "application/json" });
    downloadBlob(
      blob,
      `${safeFilename(name, "未命名工作流")}_${safeFilename(workflow?.id ?? "draft", "draft")}_${workflowExportTimestamp()}.json`,
    );
  }

  async function importJson(file?: File) {
    if (!file || locked) return;
    try {
      const json = parseImportedWorkflow(JSON.parse(await file.text()));
      load(json);
      setValidationErrors({});
      window.setTimeout(() => {
        if (json.viewport) void applyViewport(json.viewport);
        else fitView({ padding: 0.2 });
      }, 20);
      toast.success("JSON 已导入");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "工作流 JSON 格式无效");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <div
      className="ck-editor-shell relative h-screen overflow-hidden"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (contextMenu && !contextMenuRef.current?.contains(event.target as globalThis.Node))
          setContextMenu(undefined);
      }}
    >
      <main className="ck-editor-canvas absolute inset-0">
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={(_, nextViewport) => storeViewport(nextViewport)}
          isValidConnection={canConnect}
          nodesDraggable={!locked}
          nodesConnectable={!locked}
          edgesReconnectable={!locked}
          connectionLineStyle={{ stroke: "var(--ck-primary)", strokeWidth: 2 }}
          onNodeClick={(_, node) => select(node.id)}
          onPaneClick={() => {
            select(undefined);
            setToolMenu(undefined);
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            select(node.id);
            setContextMenu({
              nodeId: node.id,
              x: Math.max(8, Math.min(event.clientX, window.innerWidth - 204)),
              y: Math.max(8, Math.min(event.clientY, window.innerHeight - 184)),
            });
          }}
          defaultViewport={viewport}
          deleteKeyCode={locked ? null : ["Backspace", "Delete"]}
          minZoom={0.25}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={12}
            size={1}
            color="var(--ck-canvas-dot)"
          />
          <Controls className="figma-controls" position="bottom-left" />
        </ReactFlow>
      </main>

      {contextMenu && contextNode && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label={`${contextNode.data.label} 模块菜单`}
          tabIndex={-1}
          className="ck-node-context-menu fixed z-50 w-48 rounded-[10px] border p-1.5 outline-none"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            className="ck-node-context-item flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left"
            onClick={() => {
              setCopiedNode(structuredClone(contextNode));
              setContextMenu(undefined);
              toast.success("模块已复制");
            }}
          >
            <Copy size={14} /> 复制
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!copiedNode || locked}
            className="ck-node-context-item flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left"
            onClick={() => {
              if (!copiedNode) return;
              pasteNode(copiedNode, contextNode.id);
              setContextMenu(undefined);
              toast.success("模块已粘贴");
            }}
          >
            <ClipboardPaste size={14} /> 粘贴
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={contextNodeRun?.output === undefined}
            className="ck-node-context-item flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left"
            onClick={() => {
              setContextMenu(undefined);
              void downloadNodeOutput(contextNode, contextNodeRun).catch((error) =>
                toast.error(error instanceof Error ? error.message : "产物下载失败"),
              );
            }}
          >
            <Download size={14} /> 下载产物
          </button>
          <div className="ck-node-context-separator my-1 h-px" />
          <button
            type="button"
            role="menuitem"
            disabled={locked}
            className="ck-node-context-item is-danger flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left"
            onClick={() => {
              deleteNode(contextNode.id);
              setContextMenu(undefined);
              toast.success("模块已删除");
            }}
          >
            <Trash2 size={14} /> 删除
          </button>
        </div>
      )}

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex h-20 items-center justify-between px-3">
        <div className="ck-editor-titlebar pointer-events-auto flex h-10 items-center rounded-[10px] p-1 backdrop-blur">
          <button
            onClick={onBack}
            className="ck-editor-home grid size-8 place-items-center rounded-lg"
          >
            <Home size={17} />
          </button>
          <div className="ck-editor-separator mx-1 h-5 w-px" />
          <Input
            value={name}
            disabled={locked}
            onChange={(event) => setName(event.target.value)}
            className="ck-editor-input h-8 w-36 border-0 px-2 focus:ring-0"
          />
          <span className="ck-editor-caption flex items-center gap-1 pr-2">
            {locked ? (
              <>
                <LockKeyhole size={10} /> 运行中已锁定
              </>
            ) : (
              "可编辑"
            )}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={onRecharge}
            className="ck-editor-points ck-hover-surface flex h-8 items-center gap-1 rounded-lg px-2"
          >
            <Coins size={14} className="ck-editor-points-icon" /> {user.keys} Keys
          </button>
          <div className="ck-editor-actions flex h-14 items-center gap-1 rounded-[10px] p-2 backdrop-blur">
            <Button
              variant="secondary"
              size="sm"
              className="ck-editor-action h-10"
              onClick={save}
              disabled={saving || locked}
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 保存
            </Button>
            <Button
              size="sm"
              className="ck-editor-action-primary h-10 px-5"
              onClick={() => void execute()}
              disabled={locked || saving}
            >
              <Play size={13} fill="currentColor" /> 执行全部
              <Badge className="ml-1">
                <Coins size={10} /> {canvasKeys} Keys
              </Badge>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ck-editor-action h-10"
              onClick={cancelExecution}
              disabled={!run || terminalRunStatuses.includes(run.status)}
            >
              取消执行全部
            </Button>
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setJsonMenuOpen(false);
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                className="ck-editor-action h-10"
                aria-haspopup="menu"
                aria-expanded={jsonMenuOpen}
                onClick={() => setJsonMenuOpen((open) => !open)}
              >
                <FileJson2 size={14} /> JSON <ChevronDown size={12} />
              </Button>
              {jsonMenuOpen && (
                <div
                  className="ck-json-menu absolute right-0 top-full z-40 mt-2 w-36 rounded-lg border p-1"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="ck-menu-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left"
                    onClick={() => {
                      downloadJson();
                      setJsonMenuOpen(false);
                    }}
                  >
                    <Download size={14} /> 导出 JSON
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={locked}
                    className="ck-menu-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left disabled:opacity-40"
                    onClick={() => {
                      importRef.current?.click();
                      setJsonMenuOpen(false);
                    }}
                  >
                    <Upload size={14} /> 导入 JSON
                  </button>
                </div>
              )}
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(event) => void importJson(event.target.files?.[0])}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="absolute left-5 top-1/2 z-20 flex items-start gap-2">
        <div className="ck-editor-toolrail -translate-y-1/2 rounded-[10px] border p-1">
          {[
            { id: "input", label: "输入", icon: Plus },
            { id: "ai", label: "AI 生成", icon: Sparkles },
            { id: "render", label: "渲染", icon: LayoutGrid },
            { id: "experiment", label: "实验", icon: FlaskConical },
            { id: "history", label: "历史", icon: History },
          ].map((item, index) => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              disabled={locked && (item.id === "input" || item.id === "ai")}
              onClick={() => {
                if (item.id === "input" || item.id === "ai")
                  setToolMenu((current) =>
                    current === item.id ? undefined : (item.id as "input" | "ai"),
                  );
              }}
              className={`ck-editor-tool-button grid size-10 place-items-center rounded-lg ${index ? "mt-1" : ""} ${toolMenu === item.id ? "is-active" : ""}`}
            >
              <item.icon size={17} />
            </button>
          ))}
        </div>
        {toolMenu === "input" && (
          <div className="ck-editor-library w-52 -translate-y-1/2 rounded-[10px] border p-2">
            <p className="ck-editor-library-title px-2 pb-2 pt-1">输入</p>
            {inputNodes.map((item) => {
              const Icon = nodeIcons[item.kind] ?? Sparkles;
              return (
                <button
                  key={item.kind}
                  type="button"
                  disabled={locked}
                  onClick={() => addNode(item.kind)}
                  className="ck-editor-library-item flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left"
                >
                  <Icon size={15} className="ck-text-secondary shrink-0" />
                  <span>
                    <span className="block">{item.label}</span>
                    <span className="ck-text-faint block text-[10px]">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {toolMenu === "ai" && (
          <div className="ck-editor-library max-h-[70vh] w-64 -translate-y-1/2 overflow-y-auto rounded-[10px] border p-2">
            <p className="ck-editor-library-title px-2 pb-2 pt-1">AI 生成</p>
            {aiGroups.map((group) => (
              <div key={group.category} className="mb-2 last:mb-0">
                <button
                  type="button"
                  className="ck-editor-library-group flex h-9 w-full items-center justify-between rounded-md px-2 text-xs"
                  onClick={() => setAiCategory(group.category)}
                  aria-expanded={aiCategory === group.category}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-300 motion-reduce:transition-none ${aiCategory === group.category ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className={`ck-ai-accordion-content ${aiCategory === group.category ? "is-open" : ""}`}
                  aria-hidden={aiCategory !== group.category}
                >
                  <div className="ck-ai-accordion-inner">
                    {group.nodes.map((item) => {
                      const Icon = nodeIcons[item.kind] ?? Sparkles;
                      return (
                        <button
                          key={item.kind}
                          type="button"
                          tabIndex={aiCategory === group.category ? 0 : -1}
                          disabled={locked}
                          onClick={() => addNode(item.kind)}
                          className="ck-editor-library-item flex min-h-12 w-full items-center gap-2 rounded-md px-2 text-left"
                        >
                          <Icon size={15} className="ck-text-secondary shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block">{item.label}</span>
                            <span className="ck-text-faint block truncate text-[10px]">
                              {item.description}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-0.5">
                            {item.inputs.map((port) => (
                              <span
                                key={port.id}
                                className={`ck-port-badge ck-port-badge-${port.type}`}
                              >
                                {portBadgeLabel(port.type, port.multiple)}
                              </span>
                            ))}
                            <span className="ck-text-faint">→</span>
                            {item.outputs.map((port) => (
                              <span
                                key={port.id}
                                className={`ck-port-badge ck-port-badge-${port.type}`}
                              >
                                {portBadgeLabel(port.type)}
                              </span>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && !selectedIsInput && (
        <aside className="ck-editor-panel absolute bottom-5 right-5 top-24 z-20 w-72 overflow-y-auto rounded-xl border p-4 backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="ck-editor-panel-icon grid size-9 place-items-center rounded-lg">
                <WorkflowIcon size={15} />
              </div>
              <div>
                <h3 className="ck-editor-panel-title">{selected.data.label}</h3>
                <p className="ck-editor-node-id mt-0.5">{selected.id}</p>
              </div>
            </div>
            <button
              onClick={() => select(undefined)}
              className="ck-editor-close grid size-7 place-items-center rounded-md"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-4">
            <Button
              type="button"
              className="ck-editor-action-primary h-10 w-full"
              disabled={locked || saving}
              onClick={() => void execute(selected.id)}
            >
              <Play size={13} fill="currentColor" /> 执行当前节点
              <Badge className="ml-auto">
                <Coins size={10} /> {selectedExecutionKeys} Keys
              </Badge>
            </Button>
            {selected.data.kind.startsWith("ai.") ? (
              (() => {
                const models = catalog.models.filter((model) =>
                  model.capabilities.includes(selected.data.kind),
                );
                const configuredModelId = String(selected.data.config.model ?? "");
                const configuredModel = models.find((model) => model.id === configuredModelId);
                const activeModel = configuredModel;
                const inputFieldKeys = new Set([
                  ...(selected.data.inputs ?? []).map((port) => port.id),
                  "media",
                  "images",
                ]);
                const fields =
                  activeModel?.fields.filter((field) => !inputFieldKeys.has(field.key)) ??
                  Object.entries(selected.data.config)
                    .filter(([key]) => key !== "model" && !inputFieldKeys.has(key))
                    .map(([key, value]) => ({
                      key,
                      label: key,
                      type:
                        typeof value === "boolean"
                          ? ("boolean" as const)
                          : typeof value === "number"
                            ? ("number" as const)
                            : ("text" as const),
                      default: value as string | number | boolean,
                    }));
                return (
                  <>
                    <label className="block">
                      <span className="ck-editor-field-label mb-1.5 block">模型</span>
                      <select
                        value={configuredModelId}
                        disabled={locked}
                        onChange={(event) => {
                          const model = models.find((item) => item.id === event.target.value);
                          const preservedInputs = Object.fromEntries(
                            [...inputFieldKeys]
                              .filter((key) => selected.data.config[key] !== undefined)
                              .map((key) => [key, selected.data.config[key]]),
                          );
                          replaceConfig(selected.id, {
                            model: event.target.value,
                            ...Object.fromEntries(
                              (model?.fields ?? [])
                                .filter((field) => field.default !== undefined)
                                .map((field) => [field.key, field.default]),
                            ),
                            ...preservedInputs,
                          });
                        }}
                        className="ck-editor-input h-10 w-full rounded-md border px-3 text-xs"
                      >
                        <option value="">请选择模型</option>
                        {configuredModelId && !configuredModel ? (
                          <option value={configuredModelId} disabled>
                            {configuredModelId}（已下架）
                          </option>
                        ) : null}
                        {models.map((model) => (
                          <option key={`${model.id}-${model.name}`} value={model.id}>
                            {model.name} ·{" "}
                            {nodeExecutionKeys(selected.data.kind, model.id, catalog.models, {
                              model: model.id,
                              ...Object.fromEntries(
                                model.fields.map((field) => [field.key, field.default]),
                              ),
                            })}{" "}
                            Keys
                          </option>
                        ))}
                      </select>
                      {configuredModelId && !configuredModel && (
                        <span className="mt-1 block text-[10px] text-amber-500">
                          当前模型已下架，请选择其他模型
                        </span>
                      )}
                      {activeModel && (
                        <span className="ck-text-faint mt-1 block text-[10px]">
                          {activeModel.provider}
                        </span>
                      )}
                    </label>
                    {fields.map((field) => (
                      <ModelFieldControl
                        key={field.key}
                        field={field}
                        value={selected.data.config[field.key] ?? field.default}
                        disabled={locked}
                        onChange={(value) => updateConfig(selected.id, field.key, value)}
                      />
                    ))}
                  </>
                );
              })()
            ) : (
              <div className="ck-node-body rounded-md border p-3 text-xs">
                {selected.data.kind === "input.text"
                  ? "文本可直接在节点中编辑"
                  : selected.data.config.media
                    ? `已上传：${String((selected.data.config.media as { name?: string }).name ?? "媒体文件")}`
                    : "请在节点中上传文件"}
              </div>
            )}
          </div>
          <div className="ck-editor-state mt-6 border-t pt-4">
            <div className="flex justify-between">
              <span>执行状态</span>
              <span>{activeStates[selected.id] ?? "未运行"}</span>
            </div>
            {selectedRun?.durationMs !== undefined && (
              <div className="mt-2 flex justify-between">
                <span>节点耗时</span>
                <span>{(selectedRun.durationMs / 1000).toFixed(2)} 秒</span>
              </div>
            )}
            {selectedRun?.error && (
              <div className="ck-node-error mt-3 rounded-md p-2 text-[10px] leading-5">
                <p>{selectedRun.error}</p>
                {selectedRun.errorDetails && (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedRun.errorDetails, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {run && (
        <div className="ck-editor-status absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 backdrop-blur">
          <span
            className={`size-2 rounded-full ${run.status === "SUCCEEDED" ? "ck-status-dot-success" : run.status === "FAILED" ? "ck-status-dot-error" : "ck-status-dot-running animate-pulse"}`}
          />
          <span>运行状态：{run.status}</span>
          <Badge>
            {run.nodeRuns.filter((node) => node.status === "SUCCEEDED").length}/
            {run.nodeRuns.length} 节点
          </Badge>
          {(run.durationMs !== undefined || run.startedAt) && (
            <span>
              {((run.durationMs ?? Date.now() - new Date(run.startedAt!).getTime()) / 1000).toFixed(
                1,
              )}{" "}
              秒
            </span>
          )}
          {terminalRunStatuses.includes(run.status) && (
            <button type="button" aria-label="关闭运行状态" onClick={() => setRun(undefined)}>
              <X size={13} className="ck-text-faint" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function StudioPage(props: { user: User; onLogout: () => void; onUserRefresh: () => void }) {
  const workflowTarget = new URLSearchParams(window.location.search).get("workflow");
  const workflowIdFromUrl = workflowTarget && workflowTarget !== "new" ? workflowTarget : undefined;
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | undefined>();
  const [activeSection, setActiveSection] = useState<StudioSection>("home");
  const [editing, setEditing] = useState(Boolean(workflowTarget));
  const [openingWorkflow, setOpeningWorkflow] = useState(Boolean(workflowIdFromUrl));

  useEffect(() => {
    if (!workflowIdFromUrl) return;
    let active = true;
    api<Workflow>(`/workflows/${workflowIdFromUrl}`)
      .then((workflow) => {
        if (!active) return;
        setActiveWorkflow(workflow);
        setEditing(true);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "工作流打开失败");
        setActiveSection("workflows");
        setEditing(false);
      })
      .finally(() => {
        if (active) setOpeningWorkflow(false);
      });
    return () => {
      active = false;
    };
  }, [workflowIdFromUrl]);

  if (openingWorkflow) {
    return (
      <div className="ck-app-loading grid h-screen place-items-center">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (!editing) {
    return <Dashboard {...props} activeSection={activeSection} onNavigate={setActiveSection} />;
  }

  return (
    <ReactFlowProvider>
      <EditorCanvas
        user={props.user}
        initialWorkflow={activeWorkflow}
        onRecharge={() => {
          setActiveSection("pricing");
          setEditing(false);
        }}
        onBack={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("workflow");
          window.history.replaceState({}, "", url);
          setActiveSection("workflows");
          setEditing(false);
        }}
      />
    </ReactFlowProvider>
  );
}
