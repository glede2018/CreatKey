import type { AiModelDefinition, WorkflowNodeData, WorkflowPort } from "@/types";

export type WorkflowNodeDefinition = {
  kind: string;
  label: string;
  category: "input" | "text" | "image" | "audio" | "video";
  description: string;
  inputs: WorkflowPort[];
  outputs: WorkflowPort[];
  defaultConfig: Record<string, unknown>;
};

const textOutput: WorkflowPort[] = [{ id: "text", label: "文本", type: "text" }];
const imageOutput: WorkflowPort[] = [{ id: "image", label: "图片", type: "image" }];
const audioOutput: WorkflowPort[] = [{ id: "audio", label: "音频", type: "audio" }];
const videoOutput: WorkflowPort[] = [{ id: "video", label: "视频", type: "video" }];

export const workflowNodeCatalog: WorkflowNodeDefinition[] = [
  {
    kind: "input.text",
    label: "文本输入",
    category: "input",
    description: "输入文本或提示词",
    inputs: [],
    outputs: textOutput,
    defaultConfig: { text: "" },
  },
  {
    kind: "input.image",
    label: "图片输入",
    category: "input",
    description: "上传一张图片",
    inputs: [],
    outputs: imageOutput,
    defaultConfig: {},
  },
  {
    kind: "input.audio",
    label: "音频输入",
    category: "input",
    description: "上传音频文件",
    inputs: [],
    outputs: audioOutput,
    defaultConfig: {},
  },
  {
    kind: "input.video",
    label: "视频输入",
    category: "input",
    description: "上传视频文件",
    inputs: [],
    outputs: videoOutput,
    defaultConfig: {},
  },
  {
    kind: "ai.speech-to-text",
    label: "语音识别",
    category: "text",
    description: "将语音转换为文本",
    inputs: [{ id: "audio", label: "音频", type: "audio", required: true }],
    outputs: textOutput,
    defaultConfig: { model: "qwen3-asr-flash", language: "auto", enableItn: true },
  },
  {
    kind: "ai.multimodal-to-text",
    label: "多模态转文本",
    category: "text",
    description: "与 LLM 对话、增强提示词",
    inputs: [
      { id: "text", label: "文本", type: "text", multiple: true },
      { id: "images", label: "图片", type: "image", multiple: true },
    ],
    outputs: textOutput,
    defaultConfig: {
      model: "qwen3.5-plus",
      text: "",
      systemPrompt: "你是一个专业的创意助手。",
      temperature: 0.7,
      maxTokens: 2048,
    },
  },
  {
    kind: "ai.image-to-image",
    label: "图生图",
    category: "image",
    description: "根据图片生成图片",
    inputs: [
      { id: "image", label: "来源图", type: "image", required: true },
      { id: "prompt", label: "提示词", type: "text", required: true },
    ],
    outputs: imageOutput,
    defaultConfig: {
      model: "qwen-image-2.0-pro",
      prompt: "",
      ratio: "1:1",
      count: 1,
      promptExtend: true,
    },
  },
  {
    kind: "ai.multi-image-to-image",
    label: "多图生图",
    category: "image",
    description: "多张参考图批量生成图片",
    inputs: [
      { id: "images", label: "来源图", type: "image", required: true, multiple: true },
      { id: "prompt", label: "提示词", type: "text", required: true },
    ],
    outputs: imageOutput,
    defaultConfig: {
      model: "qwen-image-2.0-pro",
      prompt: "",
      ratio: "1:1",
      count: 1,
      promptExtend: true,
    },
  },
  {
    kind: "ai.text-to-image",
    label: "文生图",
    category: "image",
    description: "根据文本生成图片",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: imageOutput,
    defaultConfig: {
      model: "qwen-image-2.0-pro",
      prompt: "",
      ratio: "1:1",
      count: 1,
      promptExtend: true,
    },
  },
  {
    kind: "ai.music-generation",
    label: "音乐生成",
    category: "audio",
    description: "根据提示词生成音乐",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: audioOutput,
    defaultConfig: {
      model: "fun-music-v1",
      prompt: "",
      lyrics: "",
      instrumental: true,
      gender: "female",
      format: "mp3",
    },
  },
  {
    kind: "ai.text-to-speech",
    label: "文字转语音",
    category: "audio",
    description: "将文本转换为语音",
    inputs: [{ id: "text", label: "文本", type: "text", required: true }],
    outputs: audioOutput,
    defaultConfig: { model: "qwen3-tts-flash", text: "", voice: "Cherry", languageType: "Auto" },
  },
  {
    kind: "ai.text-to-video",
    label: "文生视频",
    category: "video",
    description: "根据文本生成视频",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: videoOutput,
    defaultConfig: {
      model: "wan2.7-t2v",
      prompt: "",
      ratio: "16:9",
      duration: 5,
      resolution: "1080P",
    },
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
    outputs: videoOutput,
    defaultConfig: { model: "wan2.7-i2v", prompt: "", duration: 5, resolution: "720P" },
  },
];

const legacyWorkflowNodeCatalog: WorkflowNodeDefinition[] = [
  {
    kind: "transform.template",
    label: "提示词优化",
    category: "text",
    description: "使用模板增强提示词",
    inputs: [{ id: "text", label: "文本", type: "text", required: true }],
    outputs: textOutput,
    defaultConfig: { template: "{{input}}" },
  },
  {
    kind: "image.generate",
    label: "图像生成",
    category: "image",
    description: "旧版图像生成节点",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: imageOutput,
    defaultConfig: { prompt: "" },
  },
];

export const getNodeDefinition = (kind: string) =>
  workflowNodeCatalog.find((item) => item.kind === kind) ??
  legacyWorkflowNodeCatalog.find((item) => item.kind === kind);

/** 与后端一致的节点 Keys 预估规则。 */
export function nodeExecutionKeys(
  kind: string,
  modelId?: string,
  models: AiModelDefinition[] = [],
) {
  if (kind.startsWith("input.")) return 0;
  const configured = models.find(
    (model) => model.id === modelId && model.capabilities.includes(kind),
  )?.capabilityKeys[kind];
  if (Number.isInteger(configured) && configured !== undefined && configured >= 0) {
    return configured;
  }
  if (["ai.image-to-image", "ai.multi-image-to-image"].includes(kind)) return 20;
  if (kind.includes("video")) return 30;
  if (kind.includes("image")) return 10;
  if (kind.includes("audio") || kind.includes("speech") || kind.includes("music")) return 5;
  return kind === "transform.template" ? 1 : kind.startsWith("ai.") ? 2 : 0;
}

export function hydrateNodeData(kind: string): WorkflowNodeData {
  const definition = getNodeDefinition(kind);
  if (!definition) throw new Error(`未知节点类型：${kind}`);
  return {
    kind,
    label: definition.label,
    description: definition.description,
    inputs: definition.inputs,
    outputs: definition.outputs,
    config: { ...definition.defaultConfig },
  };
}
