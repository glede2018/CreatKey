import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/types";
import { NodeOutput } from "./node-output";

interface NodeShellProps {
  data: WorkflowNodeData;
  selected: boolean;
  icon: LucideIcon;
  children: ReactNode;
  directOutput?: boolean;
}

export function NodeShell({
  data,
  selected,
  icon: Icon,
  children,
  directOutput = false,
}: NodeShellProps) {
  const outputs = data.outputs ?? [];
  const output = outputs[0];

  return (
    <div
      className={cn(
        "ck-node-card node-card group w-[186px] overflow-visible rounded-[10px] border transition",
        selected && "is-selected",
        data.validationError && "has-error",
        data.locked && "is-locked",
      )}
    >
      <div className="flex h-11 items-center justify-between px-3">
        <div className="ck-node-title flex items-center gap-2">
          <Icon size={14} className="ck-node-icon" /> {data.label}
        </div>
        <span className="flex items-center gap-2">
          {data.locked && <LockKeyhole size={11} className="ck-text-faint" />}
          <ChevronDown size={13} className="ck-node-chevron" />
        </span>
      </div>

      {data.validationError && (
        <div className="ck-node-validation mx-3 mb-2 rounded-md px-2 py-1.5 text-[10px]">{data.validationError}</div>
      )}
      <div className="relative space-y-2 px-3 pb-3">
        {children}
        {directOutput && output && (
          <Handle
            id={output.id}
            type="source"
            position={Position.Right}
            className={`ck-node-handle ck-node-output-handle ck-port-${output.type} !size-3 !border-2`}
            title={`${output.label} · ${output.type}`}
          />
        )}
      </div>
      {!directOutput && (
        <>
          <div className="ck-node-model mx-3 mb-2 truncate text-[10px]">
            {data.config.model ? String(data.config.model) : data.description}
          </div>
          <NodeOutput port={output} run={data.run} description={data.description} />
        </>
      )}
    </div>
  );
}
