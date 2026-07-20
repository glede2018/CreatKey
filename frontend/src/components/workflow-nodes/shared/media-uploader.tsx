import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/api";
import type { MediaAsset } from "@/types";
import { MediaPreview } from "./media-preview";

const accepts: Record<MediaAsset["type"], string> = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  audio: "audio/*",
  video: "video/*",
};

interface MediaUploaderProps {
  type: MediaAsset["type"];
  assets: MediaAsset[];
  multiple?: boolean;
  className?: string;
  onChange: (assets: MediaAsset[]) => void;
  disabled?: boolean;
}

export function MediaUploader({
  type,
  assets,
  multiple = false,
  className,
  onChange,
  disabled = false,
}: MediaUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length || disabled) return;
    setUploading(true);
    try {
      const uploaded: MediaAsset[] = [];
      for (const file of Array.from(files)) uploaded.push(await uploadMedia<MediaAsset>(file));
      onChange(multiple ? [...assets, ...uploaded] : [uploaded[0]]);
      toast.success("文件上传成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {assets.map((asset) => (
          <div key={asset.id} className="relative">
            <MediaPreview asset={asset} />
            <button
              type="button"
              aria-label={`移除 ${asset.name}`}
              className="nodrag ck-media-remove absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onChange(assets.filter((item) => item.id !== asset.id));
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="nodrag ck-node-upload mt-2 flex h-16 w-full items-center justify-center gap-2 rounded-md border border-dashed"
        onClick={(event) => {
          event.stopPropagation();
          fileRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void upload(event.dataTransfer.files);
        }}
        disabled={uploading || disabled}
      >
        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {assets.length ? (multiple ? "继续添加" : "替换文件") : "选择或拖入文件"}
      </button>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept={accepts[type]}
        multiple={multiple}
        onChange={(event) => void upload(event.target.files)}
      />
    </div>
  );
}
