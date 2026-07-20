export interface MediaAsset {
  id: string;
  name: string;
  type: "image" | "audio" | "video";
  mimeType: string;
  size: number;
  url: string;
}

