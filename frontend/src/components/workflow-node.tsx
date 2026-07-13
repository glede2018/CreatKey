import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Image, Sparkles, Type, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/types";

const icons = { 提示词: Type, 提示词优化: WandSparkles, 图像生成: Image };

/** 渲染画布节点卡片及其输入、输出连线端口。 */
export function WorkflowNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const Icon = icons[nodeData.label as keyof typeof icons] ?? Sparkles;
  return (
    <div
      className={cn(
        "node-card min-w-[230px] rounded-xl border bg-[#151515] shadow-2xl transition",
        selected ? "border-white/40 shadow-white/5" : "border-white/10",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-2 !border-[#151515] !bg-zinc-400"
      />
      <div className="flex items-center gap-3 border-b border-white/[.07] px-4 py-3">
        <div className="grid size-8 place-items-center rounded-lg bg-white text-black">
          <Icon size={15} />
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-100">{nodeData.label}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[.16em] text-zinc-600">Ready</div>
        </div>
      </div>
      <p className="px-4 py-3 text-xs leading-5 text-zinc-500">{nodeData.description}</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-2 !border-[#151515] !bg-white"
      />
    </div>
  );
}
