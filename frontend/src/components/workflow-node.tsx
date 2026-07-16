import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, Image, Play, Plus, Sparkles, Type, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/types";

const icons = { 提示词: Type, 提示词优化: WandSparkles, 图像生成: Image };

export function WorkflowNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const Icon = icons[nodeData.label as keyof typeof icons] ?? Sparkles;
  const status = String(nodeData.status ?? "READY");
  return (
    <div
      className={cn(
        "ck-node-card node-card group w-[240px] overflow-visible rounded-[10px] border transition",
        selected && "is-selected",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="ck-node-target !size-2.5 !border-0"
      />
      <div className="flex h-11 items-center justify-between px-3">
        <div className="ck-node-title flex items-center gap-2">
          <Icon size={14} className="ck-node-icon" /> {nodeData.label}
        </div>
        <ChevronDown size={13} className="ck-node-chevron" />
      </div>
      <div className="ck-node-body mx-3 rounded-md border p-2.5">
        {nodeData.description || "请输入描述或配置节点参数"}
      </div>
      <div className="ck-node-result flex h-10 items-center justify-end gap-1 px-3">
        <span>
          {status === "RUNNING" ? "执行中" : status === "SUCCEEDED" ? "已完成" : "生成结果"}
        </span>
        {status === "RUNNING" ? (
          <Sparkles size={12} className="ck-node-running animate-pulse" />
        ) : (
          <Play size={10} />
        )}
      </div>
      <button className="ck-node-add absolute -bottom-3 left-1/2 grid size-6 -translate-x-1/2 place-items-center rounded-full border opacity-0 transition group-hover:opacity-100">
        <Plus size={12} />
      </button>
      <Handle
        type="source"
        position={Position.Right}
        className="ck-node-source !size-2.5 !border-0"
      />
    </div>
  );
}
