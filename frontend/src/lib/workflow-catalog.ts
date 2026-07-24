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
    defaultConfig: { model: "" },
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
    defaultConfig: { model: "" },
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
    defaultConfig: { model: "" },
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
    defaultConfig: { model: "" },
  },
  {
    kind: "ai.text-to-image",
    label: "文生图",
    category: "image",
    description: "根据文本生成图片",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: imageOutput,
    defaultConfig: { model: "" },
  },
  {
    kind: "ai.music-generation",
    label: "音乐生成",
    category: "audio",
    description: "根据提示词生成音乐",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: audioOutput,
    defaultConfig: { model: "" },
  },
  {
    kind: "ai.text-to-speech",
    label: "文字转语音",
    category: "audio",
    description: "将文本转换为语音",
    inputs: [{ id: "text", label: "文本", type: "text", required: true }],
    outputs: audioOutput,
    defaultConfig: { model: "" },
  },
  {
    kind: "ai.text-to-video",
    label: "文生视频",
    category: "video",
    description: "根据文本生成视频",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: videoOutput,
    defaultConfig: { model: "" },
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
    defaultConfig: { model: "" },
  },
  {
    kind: "ai.text-to-vector",
    label: "文生矢量图",
    category: "image",
    description: "根据文本生成矢量图",
    inputs: [{ id: "prompt", label: "提示词", type: "text", required: true }],
    outputs: imageOutput,
    defaultConfig: { model: "" },
  },
  {
    kind: "ai.image-to-vector",
    label: "图片转矢量图",
    category: "image",
    description: "将图片转换为矢量图",
    inputs: [{ id: "image", label: "图片", type: "image", required: true }],
    outputs: imageOutput,
    defaultConfig: { model: "" },
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
    outputs: videoOutput,
    defaultConfig: { model: "" },
  },
  {
    kind: "ai.video-processing",
    label: "视频处理",
    category: "video",
    description: "对视频执行增强或转换处理",
    inputs: [{ id: "video", label: "视频", type: "video", required: true }],
    outputs: videoOutput,
    defaultConfig: { model: "" },
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
    outputs: videoOutput,
    defaultConfig: { model: "" },
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
    outputs: videoOutput,
    defaultConfig: { model: "" },
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
    outputs: videoOutput,
    defaultConfig: { model: "" },
  },
  {
    kind: "ai.video-resize",
    label: "视频尺寸调整",
    category: "video",
    description: "调整视频尺寸或比例",
    inputs: [{ id: "video", label: "视频", type: "video", required: true }],
    outputs: videoOutput,
    defaultConfig: { model: "" },
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
  config: Record<string, unknown> = {},
) {
  if (kind.startsWith("input.")) return 0;
  const model = models.find((model) => model.id === modelId && model.capabilities.includes(kind));
  let configured = model?.capabilityKeys[kind];
  if (Number.isInteger(configured) && configured !== undefined && configured >= 0) {
    for (const field of model?.fields ?? []) {
      const actual = config[field.key] ?? nestedConfigValue(config, field.key) ?? field.default;
      const option = field.options?.find((item) => item.value === actual);
      const keysValue = Number(option?.keysValue ?? 0);
      if (!option || option.keysMode === "NONE" || !Number.isInteger(keysValue) || keysValue < 0)
        continue;
      configured = option.keysMode === "SET" ? keysValue : configured + keysValue;
    }
  }
  const matchedRule = model?.pricingRules?.find((rule) => pricingRuleMatches(rule, config));
  configured = matchedRule?.keys ?? configured;
  if (Number.isInteger(configured) && configured !== undefined && configured >= 0) {
    return configured;
  }
  return kind === "transform.template" ? 1 : 0;
}

function nestedConfigValue(config: Record<string, unknown>, field: string) {
  return field
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
      config,
    );
}

function pricingRuleMatches(
  rule: NonNullable<AiModelDefinition["pricingRules"]>[number],
  config: Record<string, unknown>,
) {
  const actual =
    config[rule.field] ??
    rule.field
      .split(".")
      .reduce<unknown>(
        (value, key) =>
          value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
        config,
      );
  if (rule.operator === "EQ") return actual === rule.value;
  if (rule.operator === "NEQ") return actual !== rule.value;
  if (rule.operator === "IN") return Array.isArray(rule.value) && rule.value.includes(actual);
  const left = Number(actual);
  const right = Number(rule.value);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (rule.operator === "GT") return left > right;
  if (rule.operator === "GTE") return left >= right;
  if (rule.operator === "LT") return left < right;
  return left <= right;
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
