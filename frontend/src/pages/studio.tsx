import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  Coins,
  Download,
  Image,
  Loader2,
  LogOut,
  Menu,
  Play,
  Plus,
  Save,
  Sparkles,
  Type,
  Upload,
  WandSparkles,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkflowNode } from "@/components/workflow-node";
import { api } from "@/lib/api";
import { useEditor } from "@/store/editor";
import type { User, Workflow, WorkflowRun } from "@/types";

const nodeTypes = { workflow: WorkflowNode };
const library = [
  { kind: "input.text", label: "提示词", icon: Type, desc: "输入文本或创意描述" },
  { kind: "transform.template", label: "提示词优化", icon: WandSparkles, desc: "模板化增强提示词" },
  { kind: "image.generate", label: "图像生成", icon: Image, desc: "生成视觉内容" },
];

/** 工作流编辑器主体，协调画布、保存、导入导出和 DAG 运行状态。 */
function EditorCanvas({
  user,
  onLogout,
  onRecharge,
}: {
  user: User;
  onLogout: () => void;
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
  const [workflow, setWorkflow] = useState<Workflow>();
  const [name, setName] = useState("霓虹产品视觉");
  const [run, setRun] = useState<WorkflowRun>();
  const [saving, setSaving] = useState(false);
  const selected = nodes.find((n) => n.id === selectedId);
  const activeStates = useMemo(
    () => Object.fromEntries((run?.nodeRuns ?? []).map((n) => [n.nodeKey, n.status])),
    [run],
  );
  const displayNodes = nodes.map((node) => ({
    ...node,
    data: { ...node.data, status: activeStates[node.id] },
  }));

  useEffect(() => {
    api<Workflow[]>("/workflows")
      .then((items) => {
        if (items[0]) {
          setWorkflow(items[0]);
          setName(items[0].name);
          load(items[0].definition);
          setTimeout(() => fitView({ padding: 0.2 }), 20);
        }
      })
      .catch(() => undefined);
  }, [fitView, load]);
  useEffect(() => {
    if (!run || ["SUCCEEDED", "FAILED", "CANCELED"].includes(run.status)) return;
    const timer = setInterval(
      () =>
        api<WorkflowRun>(`/runs/${run.id}`)
          .then(setRun)
          .catch(() => undefined),
      1200,
    );
    return () => clearInterval(timer);
  }, [run]);

  /** 创建或更新当前工作流。 */
  const save = useCallback(async () => {
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
    } finally {
      setSaving(false);
    }
  }, [exportFlow, name, workflow]);
  /** 保存最新定义后创建一次工作流运行。 */
  async function execute() {
    let current = workflow;
    if (!current) {
      await save();
      const list = await api<Workflow[]>("/workflows");
      current = list[0];
    } else {
      await save();
    }
    if (!current) return;
    try {
      setRun(await api<WorkflowRun>(`/workflows/${current.id}/runs`, { method: "POST" }));
      toast.success("工作流开始执行");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "执行失败");
    }
  }
  /** 将画布定义序列化并下载为 JSON 文件。 */
  function downloadJson() {
    const blob = new Blob([JSON.stringify(exportFlow(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  /** 校验并载入用户选择的工作流 JSON 文件。 */
  async function importJson(file?: File) {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (json.schemaVersion !== 1 || !Array.isArray(json.nodes) || !Array.isArray(json.edges))
        throw new Error();
      load(json);
      setTimeout(() => fitView({ padding: 0.2 }), 20);
      toast.success("JSON 已导入");
    } catch {
      toast.error("工作流 JSON 格式无效");
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#080808] text-white">
      <header className="flex h-14 shrink-0 items-center border-b border-white/[.07] bg-[#0b0b0b] px-3">
        <div className="flex w-64 items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-white text-black">
            <Sparkles size={15} />
          </div>
          <span className="text-sm font-semibold tracking-[.16em]">CREATKEY</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-56 border-transparent bg-transparent text-center font-medium hover:border-white/10"
          />
        </div>
        <div className="flex w-auto items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={downloadJson}>
            <Download size={14} />
            导出
          </Button>
          <Button variant="ghost" size="sm" onClick={() => importRef.current?.click()}>
            <Upload size={14} />
            导入
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => importJson(e.target.files?.[0])}
          />
          <Button variant="secondary" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}保存
          </Button>
          <Button size="sm" onClick={execute}>
            <Play size={13} fill="currentColor" />
            运行
          </Button>
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button
            onClick={onRecharge}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-white/[.06]"
          >
            <Coins size={14} />
            <b>{user.points}</b> 点
          </button>
          <button className="group relative grid size-8 place-items-center rounded-full bg-zinc-800 text-xs">
            {user.nickname.slice(0, 1)}
            <span className="pointer-events-none absolute right-0 top-9 z-50 hidden w-28 rounded-lg border border-white/10 bg-[#151515] p-1 group-hover:block">
              <span
                onClick={onLogout}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400 hover:bg-white/[.06] hover:text-white"
              >
                <LogOut size={13} />
                退出登录
              </span>
            </span>
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 border-r border-white/[.07] bg-[#0c0c0c] p-3">
          <div className="mb-4 flex items-center justify-between px-2">
            <span className="text-xs font-medium text-zinc-400">节点库</span>
            <Menu size={14} className="text-zinc-600" />
          </div>
          <div className="space-y-2">
            {library.map((item) => (
              <button
                key={item.kind}
                onClick={() => addNode(item.kind, item.label)}
                className="group flex w-full items-center gap-3 rounded-xl border border-white/[.07] bg-[#121212] p-3 text-left hover:border-white/15 hover:bg-[#171717]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[.07] text-zinc-400 group-hover:bg-white group-hover:text-black">
                  <item.icon size={15} />
                </span>
                <span>
                  <b className="block text-xs font-medium text-zinc-200">{item.label}</b>
                  <small className="mt-1 block text-[10px] text-zinc-600">{item.desc}</small>
                </span>
                <Plus size={13} className="ml-auto text-zinc-700" />
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-white/10 p-4">
            <p className="text-[11px] leading-5 text-zinc-600">
              点击节点添加到画布，拖动端口建立连接。运行前系统会自动检查环路。
            </p>
          </div>
        </aside>
        <main className="relative min-w-0 flex-1 bg-[#090909]">
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
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#262626" />
            <Controls className="dark-controls" />
            <MiniMap className="dark-minimap" nodeColor="#333" maskColor="rgba(8,8,8,.75)" />
          </ReactFlow>
          {run && (
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-xs shadow-xl backdrop-blur">
              <span
                className={`size-2 rounded-full ${run.status === "SUCCEEDED" ? "bg-emerald-400" : run.status === "FAILED" ? "bg-red-400" : "animate-pulse bg-amber-300"}`}
              />
              <span className="text-zinc-300">运行状态：{run.status}</span>
              <Badge>
                {run.nodeRuns.filter((n) => n.status === "SUCCEEDED").length}/{run.nodeRuns.length}{" "}
                节点
              </Badge>
              <button onClick={() => setRun(undefined)}>
                <X size={13} className="text-zinc-500" />
              </button>
            </div>
          )}
        </main>
        <aside className="w-72 shrink-0 border-l border-white/[.07] bg-[#0c0c0c] p-4">
          {selected ? (
            <>
              <div className="mb-5 flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-white text-black">
                  <WorkflowIcon size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-medium">{selected.data.label}</h3>
                  <p className="text-[10px] text-zinc-600">{selected.id}</p>
                </div>
              </div>
              <div className="space-y-4">
                {Object.entries(selected.data.config).map(([key, value]) => (
                  <label key={key} className="block">
                    <span className="mb-1.5 block text-[11px] capitalize text-zinc-500">{key}</span>
                    <Input
                      value={String(value)}
                      onChange={(e) => updateConfig(selected.id, key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-6 border-t border-white/[.07] pt-4">
                <div className="mb-2 flex justify-between text-[11px] text-zinc-600">
                  <span>执行状态</span>
                  <span>{activeStates[selected.id] ?? "未运行"}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[.03]">
                <WorkflowIcon size={18} className="text-zinc-600" />
              </div>
              <p className="mt-4 text-sm text-zinc-400">选择一个节点</p>
              <p className="mt-2 text-xs leading-5 text-zinc-700">在右侧编辑参数并查看执行状态</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** 注入 React Flow 上下文并渲染完整工作台。 */
export function StudioPage(props: { user: User; onLogout: () => void; onRecharge: () => void }) {
  return (
    <ReactFlowProvider>
      <EditorCanvas {...props} />
    </ReactFlowProvider>
  );
}
