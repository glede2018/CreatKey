import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, Clock3, Loader2 } from "lucide-react";
import type { MediaAsset, RunNode, WorkflowPort } from "@/types";
import { MediaPreview } from "./media-preview";

interface NodeOutputProps {
  port?: WorkflowPort;
  run?: RunNode;
  description?: string;
}

function outputAsset(output: unknown, type: WorkflowPort["type"]): MediaAsset | undefined {
  if (!output || typeof output !== "object") return undefined;
  const record = output as Record<string, unknown>;
  const raw = Array.isArray(record.assets)
    ? record.assets[0]
    : record.artifact && typeof record.artifact === "object"
      ? record.artifact
      : undefined;
  if (!raw || typeof raw !== "object" || typeof (raw as { url?: unknown }).url !== "string") return undefined;
  const asset = raw as Partial<MediaAsset> & { url: string };
  return {
    id: asset.id ?? asset.url,
    name: asset.name ?? `生成的${type}`,
    type: type === "text" ? "image" : type,
    mimeType: asset.mimeType ?? `${type}/*`,
    size: asset.size ?? 0,
    url: asset.url,
  };
}

function outputText(output: unknown) {
  if (typeof output === "string") return output;
  if (!output || typeof output !== "object") return undefined;
  const record = output as Record<string, unknown>;
  return typeof record.value === "string"
    ? record.value
    : typeof record.text === "string"
      ? record.text
      : undefined;
}

export function NodeOutput({ port, run, description }: NodeOutputProps) {
  const asset = port ? outputAsset(run?.output, port.type) : undefined;
  const text = outputText(run?.output);
  const elapsedMs = run?.durationMs ?? (
    run?.status === "RUNNING" && run.startedAt ? Date.now() - new Date(run.startedAt).getTime() : undefined
  );
  return (
    <section className="ck-node-output relative mx-3 mb-3 rounded-md border p-2.5">
      {port && (
        <Handle
          id={port.id}
          type="source"
          position={Position.Right}
          className={`ck-node-handle ck-node-output-handle ck-port-${port.type} !size-3 !border-2`}
          title={`${port.label} · ${port.type}`}
        />
      )}
      <div className="mb-2 flex items-center justify-between text-[10px]">
        <span>{port?.label ?? "生成结果"}</span>
        {elapsedMs !== undefined && (
          <span className="flex items-center gap-1"><Clock3 size={10} /> {(elapsedMs / 1000).toFixed(1)}s</span>
        )}
      </div>
      {run?.status === "RUNNING" ? (
        <div className="flex h-16 items-center justify-center gap-2 text-[10px]"><Loader2 size={14} className="animate-spin" />运行中</div>
      ) : run?.status === "FAILED" ? (
        <div className="ck-node-error flex items-start gap-2 rounded p-2 text-[10px]"><AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>{run.error || "节点执行失败"}</span></div>
      ) : run?.status === "SKIPPED" ? (
        <div className="ck-text-faint py-2 text-[10px]">因上游失败，已跳过</div>
      ) : asset ? (
        <MediaPreview asset={asset} />
      ) : text ? (
        <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-[10px] leading-5">{text}</p>
      ) : (
        <p className="ck-text-faint py-1 text-[10px]">{description || "执行后在这里显示结果"}</p>
      )}
    </section>
  );
}
