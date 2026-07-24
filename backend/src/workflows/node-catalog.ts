export type PortDataType = "text" | "image" | "audio" | "video";

export interface NodePortDefinition {
  id: string;
  label: string;
  type: PortDataType;
  required?: boolean;
  multiple?: boolean;
}

export interface NodeDefinition {
  kind: string;
  label: string;
  category: "input" | "text" | "image" | "audio" | "video";
  description: string;
  inputs: NodePortDefinition[];
  outputs: NodePortDefinition[];
}

export const nodeCatalog: NodeDefinition[] = [
  {
    kind: "input.text",
    label: "文本输入",
    category: "input",
    description: "输入文本或提示词",
    inputs: [],
    outputs: [{ id: "text", label: "文本", type: "text" }],
  },
  {
    kind: "input.image",
    label: "图片输入",
    category: "input",
    description: "上传一张图片",
    inputs: [],
    outputs: [{ id: "image", label: "图片", type: "image" }],
  },
  {
    kind: "input.audio",
    label: "音频输入",
    category: "input",
    description: "上传音频文件",
    inputs: [],
    outputs: [{ id: "audio", label: "音频", type: "audio" }],
  },
  {
    kind: "input.video",
    label: "视频输入",
    category: "input",
    description: "上传视频文件",
    inputs: [],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
  {
    kind: "ai.speech-to-text",
    label: "语音识别",
    category: "text",
    description: "将语音转换为文本",
    inputs: [{ id: "audio", label: "音频", type: "audio", required: true }],
    outputs: [{ id: "text", label: "文本", type: "text" }],
  },
  {
    kind: "ai.multimodal-to-text",
    label: "多模态转文本",
    category: "text",
    description: "使用文本和图片与大模型对话",
    inputs: [
      { id: "text", label: "文本", type: "text", multiple: true },
      { id: "images", label: "图片", type: "image", multiple: true },
    ],
    outputs: [{ id: "text", label: "文本", type: "text" }],
  },
  {
    kind: "ai.image-to-image",
    label: "图生图",
    category: "image",
    description: "根据一张参考图生成图片",
    inputs: [
      { id: "image", label: "来源图", type: "image", required: true },
      { id: "prompt", label: "提示词", type: "text", required: true },
    ],
    outputs: [{ id: "image", label: "图片", type: "image" }],
  },
  {
    kind: "ai.multi-image-to-image",
    label: "多图生图",
    category: "image",
    description: "根据多张参考图生成图片",
    inputs: [
      { id: "images", label: "来源图", type: "image", required: true, multiple: true },
      { id: "prompt", label: "提示词", type: "text", required: true },
    ],
    outputs: [{ id: "image", label: "图片", type: "image" }],
  },
  {
    kind: "ai.text-to-image",
    label: "文生图",
    category: "image",
    description: "根据文本提示生成图片",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: [{ id: "image", label: "图片", type: "image" }],
  },
  {
    kind: "ai.music-generation",
    label: "音乐生成",
    category: "audio",
    description: "根据提示词生成音乐",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: [{ id: "audio", label: "音频", type: "audio" }],
  },
  {
    kind: "ai.text-to-speech",
    label: "文字转语音",
    category: "audio",
    description: "将文本转换为语音",
    inputs: [{ id: "text", label: "文本", type: "text", required: true }],
    outputs: [{ id: "audio", label: "音频", type: "audio" }],
  },
  {
    kind: "ai.text-to-video",
    label: "文生视频",
    category: "video",
    description: "根据文本生成视频",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
  {
    kind: "ai.image-to-video",
    label: "图生视频",
    category: "video",
    description: "根据图片生成视频",
    inputs: [
      { id: "image", label: "图片", type: "image", required: true },
      { id: "prompt", label: "提示词", type: "text", required: true },
    ],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
  {
    kind: "ai.text-to-vector",
    label: "文生矢量图",
    category: "image",
    description: "根据文本生成矢量图",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: [{ id: "image", label: "图片", type: "image" }],
  },
  {
    kind: "ai.image-to-vector",
    label: "图片转矢量图",
    category: "image",
    description: "将图片转换为矢量图",
    inputs: [{ id: "image", label: "图片", type: "image", required: true }],
    outputs: [{ id: "image", label: "图片", type: "image" }],
  },
  {
    kind: "ai.motion-control",
    label: "动作控制",
    category: "video",
    description: "使用参考动作驱动图片生成视频",
    inputs: [
      { id: "image", label: "图片", type: "image", required: true },
      { id: "video", label: "动作视频", type: "video", required: true },
    ],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
  {
    kind: "ai.video-processing",
    label: "视频处理",
    category: "video",
    description: "对视频执行增强或转换处理",
    inputs: [{ id: "video", label: "视频", type: "video", required: true }],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
  {
    kind: "ai.video-edit",
    label: "视频编辑",
    category: "video",
    description: "根据提示词编辑视频",
    inputs: [
      { id: "video", label: "视频", type: "video", required: true },
      { id: "prompt", label: "提示词", type: "text" },
    ],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
  {
    kind: "ai.reference-to-video",
    label: "参考图生视频",
    category: "video",
    description: "根据一张或多张参考图生成视频",
    inputs: [
      { id: "images", label: "参考图", type: "image", required: true, multiple: true },
      { id: "prompt", label: "提示词", type: "text" },
    ],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
  {
    kind: "ai.video-extend",
    label: "视频延长",
    category: "video",
    description: "延长已有视频内容",
    inputs: [
      { id: "video", label: "视频", type: "video", required: true },
      { id: "prompt", label: "提示词", type: "text" },
    ],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
  {
    kind: "ai.video-resize",
    label: "视频尺寸调整",
    category: "video",
    description: "调整视频尺寸或比例",
    inputs: [{ id: "video", label: "视频", type: "video", required: true }],
    outputs: [{ id: "video", label: "视频", type: "video" }],
  },
];

const legacyNodeCatalog: NodeDefinition[] = [
  {
    kind: "transform.template",
    label: "提示词优化",
    category: "text",
    description: "使用模板增强提示词",
    inputs: [{ id: "text", label: "文本", type: "text", required: true }],
    outputs: [{ id: "text", label: "文本", type: "text" }],
  },
  {
    kind: "image.generate",
    label: "图像生成",
    category: "image",
    description: "旧版图像生成节点",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: [{ id: "image", label: "图片", type: "image" }],
  },
];

export const nodeDefinition = (kind: string) =>
  nodeCatalog.find((item) => item.kind === kind) ??
  legacyNodeCatalog.find((item) => item.kind === kind);

/** 当前阶段的统一 Keys 计价；前端使用相同规则展示执行预估。 */
export function nodeExecutionKeys(kind: string) {
  if (kind.startsWith("input.")) return 0;
  if (["ai.image-to-image", "ai.multi-image-to-image"].includes(kind)) return 20;
  if (kind.includes("video")) return 30;
  if (kind.includes("image")) return 10;
  if (kind.includes("audio") || kind.includes("speech") || kind.includes("music")) return 5;
  return kind === "transform.template" ? 1 : kind.startsWith("ai.") ? 2 : 0;
}
