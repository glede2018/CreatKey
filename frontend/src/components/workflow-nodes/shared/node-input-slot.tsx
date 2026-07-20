import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Link2, X } from "lucide-react";
import type { ConnectedInputPreview, WorkflowPort } from "@/types";
import { MediaPreview } from "./media-preview";

interface NodeInputSlotProps {
  port: WorkflowPort;
  previews: ConnectedInputPreview[];
  locked: boolean;
  children?: ReactNode;
  onDisconnect: (edgeId: string) => void;
}

export function NodeInputSlot({
  port,
  previews,
  locked,
  children,
  onDisconnect,
}: NodeInputSlotProps) {
  return (
    <section className="ck-node-input-slot relative rounded-md border p-2.5">
      <Handle
        id={port.id}
        type="target"
        position={Position.Left}
        className={`ck-node-handle ck-node-inline-handle ck-port-${port.type} !size-3 !border-2`}
        title={`${port.label} · ${port.type}${port.multiple ? " · 可多连" : ""}`}
      />
      <div className="mb-2 flex items-center justify-between text-[10px]">
        <span className="ck-node-slot-label">{port.label}{port.required ? " *" : ""}</span>
        <span className="ck-text-faint">{port.multiple ? "多输入" : port.type}</span>
      </div>
      {previews.length > 0 && (
        <div className="mb-2 space-y-2">
          {previews.map((preview) => (
            <div key={preview.edgeId} className="ck-node-connected relative rounded-md border p-1.5">
              {preview.asset ? (
                <MediaPreview asset={preview.asset} />
              ) : (
                <div className="flex min-h-9 items-center gap-2 px-1 text-[10px]">
                  <Link2 size={12} />
                  <span className="truncate">{preview.text || preview.sourceLabel}</span>
                </div>
              )}
              <span className="mt-1 block truncate px-1 text-[10px]">来自 {preview.sourceLabel}</span>
              <button
                type="button"
                aria-label={`断开 ${preview.sourceLabel}`}
                disabled={locked}
                className="nodrag ck-media-remove absolute right-1 top-1 grid size-5 place-items-center rounded-full disabled:hidden"
                onClick={(event) => {
                  event.stopPropagation();
                  onDisconnect(preview.edgeId);
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}
