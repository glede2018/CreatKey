import { Sparkles, type LucideIcon } from "lucide-react";
import { useEditor } from "@/store/editor";
import type { MediaAsset } from "@/types";
import type { WorkflowNodeComponentProps } from "../types";
import { MediaUploader } from "./media-uploader";
import { NodeInputSlot } from "./node-input-slot";
import { NodeShell } from "./node-shell";
import { PromptEditor } from "./prompt-editor";

interface ConfigurableNodeProps extends WorkflowNodeComponentProps {
  icon?: LucideIcon;
  editableKey?: "prompt" | "text";
  mediaType?: MediaAsset["type"];
  multipleMedia?: boolean;
  directOutput?: boolean;
}

export function ConfigurableNode({
  id,
  data,
  selected,
  icon = Sparkles,
  editableKey,
  mediaType,
  multipleMedia = false,
  directOutput = false,
}: ConfigurableNodeProps) {
  const updateConfig = useEditor((state) => state.updateConfig);
  const deleteEdge = useEditor((state) => state.deleteEdge);
  const inputs = data.inputs ?? [];
  const locked = Boolean(data.locked);
  const assets = multipleMedia
    ? ((data.config.images as MediaAsset[] | undefined) ?? [])
    : data.config.media
      ? [data.config.media as MediaAsset]
      : [];

  return (
    <NodeShell data={data} selected={selected} icon={icon} directOutput={directOutput}>
      {inputs.map((port) => {
        const previews = data.connectedInputs?.[port.id] ?? [];
        const isEditableText = port.type === "text" && port.id === editableKey;
        const isEditableMedia = port.type === mediaType;
        return (
          <NodeInputSlot
            key={port.id}
            port={port}
            previews={previews}
            locked={locked}
            onDisconnect={deleteEdge}
          >
            {isEditableText && editableKey && (
              <PromptEditor
                field={editableKey}
                value={String(data.config[editableKey] ?? "")}
                disabled={locked}
                onChange={(value) => updateConfig(id, editableKey, value)}
              />
            )}
            {isEditableMedia && mediaType && (port.multiple || previews.length === 0) && (
              <MediaUploader
                type={mediaType}
                assets={assets}
                multiple={multipleMedia}
                disabled={locked}
                onChange={(nextAssets) => {
                  if (multipleMedia) updateConfig(id, "images", nextAssets);
                  else updateConfig(id, "media", nextAssets[0]);
                }}
              />
            )}
          </NodeInputSlot>
        );
      })}

      {inputs.length === 0 && editableKey && (
        <div className="ck-node-body rounded-md border p-2.5">
          <PromptEditor
            field={editableKey}
            value={String(data.config[editableKey] ?? "")}
            disabled={locked}
            onChange={(value) => updateConfig(id, editableKey, value)}
          />
        </div>
      )}
      {inputs.length === 0 && mediaType && (
        <div className="ck-node-body rounded-md border p-2.5">
          <MediaUploader
            type={mediaType}
            assets={assets}
            multiple={multipleMedia}
            disabled={locked}
            onChange={(nextAssets) => {
              if (multipleMedia) updateConfig(id, "images", nextAssets);
              else updateConfig(id, "media", nextAssets[0]);
            }}
          />
        </div>
      )}
      {!editableKey && !mediaType && inputs.length === 0 && (
        <span>{data.description || "配置节点参数"}</span>
      )}
    </NodeShell>
  );
}
