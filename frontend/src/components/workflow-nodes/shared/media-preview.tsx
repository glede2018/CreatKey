import type { MediaAsset } from "@/types";

interface MediaPreviewProps {
  asset: MediaAsset;
}

export function MediaPreview({ asset }: MediaPreviewProps) {
  if (asset.type === "image") {
    return <img src={asset.url} alt={asset.name} className="h-28 w-full rounded-md object-cover" />;
  }
  if (asset.type === "audio") {
    return <audio src={asset.url} controls className="nodrag w-full" />;
  }
  return <video src={asset.url} controls className="nodrag h-32 w-full rounded-md object-cover" />;
}
