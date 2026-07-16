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
  CircleHelp,
  Coins,
  Download,
  Home,
  Image,
  LayoutGrid,
  Loader2,
  LogOut,
  Play,
  Plus,
  Save,
  Sparkles,
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
import { WorkflowNode } from "@/components/workflow-node";
import { api } from "@/lib/api";
import { useEditor } from "@/store/editor";
import type { User, Workflow, WorkflowDefinition, WorkflowRun } from "@/types";

const nodeTypes = { workflow: WorkflowNode };
const library = [
  { kind: "input.text", label: "提示词", icon: Type, desc: "输入文本或创意描述" },
  { kind: "transform.template", label: "提示词优化", icon: WandSparkles, desc: "模板化增强提示词" },
  { kind: "image.generate", label: "图像生成", icon: Image, desc: "生成视觉内容" },
];
const emptyWorkflow: WorkflowDefinition = { schemaVersion: 1, nodes: [], edges: [] };

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
  onOpen,
  activeSection,
  onNavigate,
}: {
  user: User;
  onLogout: () => void;
  onUserRefresh: () => void;
  onOpen: (workflow?: Workflow) => void;
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
          <WorkflowsPage onOpen={onOpen} />
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
    selectedId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    select,
    updateConfig,
    addNode,
    load,
    export: exportFlow,
  } = useEditor();
  const { fitView } = useReactFlow();
  const importRef = useRef<HTMLInputElement>(null);
  const [workflow, setWorkflow] = useState<Workflow | undefined>(initialWorkflow);
  const [name, setName] = useState(initialWorkflow?.name ?? "未命名");
  const [run, setRun] = useState<WorkflowRun>();
  const [saving, setSaving] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const selected = nodes.find((node) => node.id === selectedId);
  const activeStates = useMemo(
    () => Object.fromEntries((run?.nodeRuns ?? []).map((node) => [node.nodeKey, node.status])),
    [run],
  );
  const displayNodes = nodes.map((node) => ({
    ...node,
    data: { ...node.data, status: activeStates[node.id] },
  }));

  useEffect(() => {
    load(initialWorkflow?.definition ?? emptyWorkflow);
    const timer = window.setTimeout(() => fitView({ padding: 0.24 }), 30);
    return () => window.clearTimeout(timer);
  }, [fitView, initialWorkflow, load]);

  useEffect(() => {
    if (!run || ["SUCCEEDED", "FAILED", "CANCELED"].includes(run.status)) return;
    const timer = window.setInterval(
      () =>
        api<WorkflowRun>(`/runs/${run.id}`)
          .then(setRun)
          .catch(() => undefined),
      1200,
    );
    return () => window.clearInterval(timer);
  }, [run]);

  async function save() {
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

  async function execute() {
    const current = await save();
    if (!current) return;
    try {
      setRun(await api<WorkflowRun>(`/workflows/${current.id}/runs`, { method: "POST" }));
      toast.success("工作流开始执行");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "执行失败");
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(exportFlow(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file?: File) {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (json.schemaVersion !== 1 || !Array.isArray(json.nodes) || !Array.isArray(json.edges))
        throw new Error();
      load(json);
      window.setTimeout(() => fitView({ padding: 0.2 }), 20);
      toast.success("JSON 已导入");
    } catch {
      toast.error("工作流 JSON 格式无效");
    }
  }

  return (
    <div className="ck-editor-shell relative h-screen overflow-hidden">
      <main className="ck-editor-canvas absolute inset-0">
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => select(node.id)}
          onPaneClick={() => select(undefined)}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
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
            onChange={(event) => setName(event.target.value)}
            className="ck-editor-input h-8 w-36 border-0 px-2 focus:ring-0"
          />
          <span className="ck-editor-caption pr-2">自动保存于 20:12:13</span>
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
              onClick={downloadJson}
            >
              <Download size={14} /> 9:16
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ck-editor-action h-10"
              onClick={() => importRef.current?.click()}
            >
              <Upload size={14} /> 上传作为模板
            </Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => importJson(event.target.files?.[0])}
            />
            <Button
              variant="secondary"
              size="sm"
              className="ck-editor-action h-10"
              onClick={save}
              disabled={saving}
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 保存
            </Button>
            <Button size="sm" className="ck-editor-action-primary h-10 px-5" onClick={execute}>
              <Play size={13} fill="currentColor" /> 执行全部
              <Badge className="ml-1">{nodes.length}</Badge>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ck-editor-action h-10"
              onClick={() => setRun(undefined)}
            >
              取消执行全部
            </Button>
          </div>
        </div>
      </header>

      <div className="absolute left-5 top-1/2 z-20 flex -translate-y-1/2 items-start gap-2">
        <div className="ck-editor-toolrail rounded-[10px] border p-1">
          <button
            onClick={() => setLibraryOpen((value) => !value)}
            className="ck-editor-tool-button is-active grid size-10 place-items-center rounded-lg"
          >
            <Plus size={18} />
          </button>
          {[Sparkles, LayoutGrid, WandSparkles, CircleHelp].map((Icon, index) => (
            <button
              key={index}
              className="ck-editor-tool-button mt-1 grid size-10 place-items-center rounded-lg"
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
        {libraryOpen && (
          <div className="ck-editor-library w-40 rounded-[10px] border p-2">
            <p className="ck-editor-library-title px-2 pb-2 pt-1">添加</p>
            {library.map((item) => (
              <button
                key={item.kind}
                onClick={() => addNode(item.kind, item.label)}
                className="ck-editor-library-item flex h-9 w-full items-center gap-2 rounded-md px-2"
              >
                <item.icon size={15} className="ck-text-secondary" /> {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
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
            {Object.entries(selected.data.config).map(([key, value]) => (
              <label key={key} className="block">
                <span className="ck-editor-field-label mb-1.5 block capitalize">{key}</span>
                <Input
                  value={String(value)}
                  onChange={(event) => updateConfig(selected.id, key, event.target.value)}
                  className="ck-editor-input"
                />
              </label>
            ))}
          </div>
          <div className="ck-editor-state mt-6 border-t pt-4">
            <div className="flex justify-between">
              <span>执行状态</span>
              <span>{activeStates[selected.id] ?? "未运行"}</span>
            </div>
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
          <button onClick={() => setRun(undefined)}>
            <X size={13} className="ck-text-faint" />
          </button>
        </div>
      )}
    </div>
  );
}

export function StudioPage(props: { user: User; onLogout: () => void; onUserRefresh: () => void }) {
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | undefined>();
  const [activeSection, setActiveSection] = useState<StudioSection>("home");
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Dashboard
        {...props}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onOpen={(workflow) => {
          setActiveWorkflow(workflow);
          setEditing(true);
        }}
      />
    );
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
          setActiveSection("workflows");
          setEditing(false);
        }}
      />
    </ReactFlowProvider>
  );
}
