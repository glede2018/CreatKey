export type ModelField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | "textarea";
  default?: string | number | boolean;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
};

export type AiModelDefinition = {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  capabilityKeys: Record<string, number>;
  fields: ModelField[];
};

const ratioOptions = ["1:1", "16:9", "9:16", "4:3", "3:4"].map((value) => ({
  label: value,
  value,
}));
const imageFields: ModelField[] = [
  { key: "ratio", label: "宽高比", type: "select", default: "1:1", options: ratioOptions },
  { key: "count", label: "生成数量", type: "number", default: 1, min: 1, max: 6, step: 1 },
  { key: "negativePrompt", label: "反向提示词", type: "textarea", default: "" },
  { key: "promptExtend", label: "智能改写提示词", type: "boolean", default: true },
];

export const aiModelCatalog: AiModelDefinition[] = [
  {
    id: "qwen3-asr-flash",
    name: "千问 3 ASR Flash",
    provider: "aliyun-bailian",
    capabilities: ["ai.speech-to-text"],
    capabilityKeys: { "ai.speech-to-text": 5 },
    fields: [
      {
        key: "language",
        label: "语言",
        type: "select",
        default: "auto",
        options: [
          { label: "自动识别", value: "auto" },
          { label: "中文", value: "zh" },
          { label: "英文", value: "en" },
          { label: "日语", value: "ja" },
          { label: "韩语", value: "ko" },
        ],
      },
      { key: "enableItn", label: "数字规范化", type: "boolean", default: true },
    ],
  },
  {
    id: "qwen3.5-plus",
    name: "千问 3.5 Plus",
    provider: "aliyun-bailian",
    capabilities: ["ai.multimodal-to-text"],
    capabilityKeys: { "ai.multimodal-to-text": 2 },
    fields: [
      {
        key: "systemPrompt",
        label: "系统提示词",
        type: "textarea",
        default: "你是一个专业的创意助手。",
      },
      {
        key: "temperature",
        label: "创造性",
        type: "number",
        default: 0.7,
        min: 0,
        max: 2,
        step: 0.1,
      },
      {
        key: "maxTokens",
        label: "最大输出",
        type: "number",
        default: 2048,
        min: 64,
        max: 8192,
        step: 64,
      },
    ],
  },
  {
    id: "qwen-image-2.0-pro",
    name: "千问 Image 2.0 Pro",
    provider: "aliyun-bailian",
    capabilities: ["ai.text-to-image"],
    capabilityKeys: { "ai.text-to-image": 10 },
    fields: imageFields,
  },
  {
    id: "qwen-image-2.0-pro",
    name: "千问 Image 2.0 Pro 编辑",
    provider: "aliyun-bailian",
    capabilities: ["ai.image-to-image", "ai.multi-image-to-image"],
    capabilityKeys: { "ai.image-to-image": 20, "ai.multi-image-to-image": 20 },
    fields: imageFields,
  },
  {
    id: "qwen3-tts-flash",
    name: "千问 3 TTS Flash",
    provider: "aliyun-bailian",
    capabilities: ["ai.text-to-speech"],
    capabilityKeys: { "ai.text-to-speech": 5 },
    fields: [
      {
        key: "voice",
        label: "音色",
        type: "select",
        default: "Cherry",
        options: [
          { label: "Cherry", value: "Cherry" },
          { label: "Serena", value: "Serena" },
          { label: "Ethan", value: "Ethan" },
          { label: "Chelsie", value: "Chelsie" },
        ],
      },
      {
        key: "languageType",
        label: "语言",
        type: "select",
        default: "Auto",
        options: [
          { label: "自动", value: "Auto" },
          { label: "中文", value: "Chinese" },
          { label: "英文", value: "English" },
          { label: "日语", value: "Japanese" },
          { label: "韩语", value: "Korean" },
        ],
      },
    ],
  },
  {
    id: "fun-music-v1",
    name: "Fun-Music V1（邀测）",
    provider: "aliyun-bailian",
    capabilities: ["ai.music-generation"],
    capabilityKeys: { "ai.music-generation": 5 },
    fields: [
      { key: "lyrics", label: "歌词（填写后优先）", type: "textarea", default: "" },
      { key: "instrumental", label: "纯音乐", type: "boolean", default: true },
      {
        key: "gender",
        label: "人声",
        type: "select",
        default: "female",
        options: [
          { label: "女声", value: "female" },
          { label: "男声", value: "male" },
        ],
      },
      {
        key: "format",
        label: "格式",
        type: "select",
        default: "mp3",
        options: [
          { label: "MP3", value: "mp3" },
          { label: "WAV", value: "wav" },
        ],
      },
    ],
  },
  {
    id: "wan2.7-t2v",
    name: "万相 2.7 文生视频",
    provider: "aliyun-bailian",
    capabilities: ["ai.text-to-video"],
    capabilityKeys: { "ai.text-to-video": 30 },
    fields: [
      { key: "ratio", label: "宽高比", type: "select", default: "16:9", options: ratioOptions },
      {
        key: "duration",
        label: "时长（秒）",
        type: "select",
        default: 5,
        options: [
          { label: "5 秒", value: 5 },
          { label: "10 秒", value: 10 },
          { label: "15 秒", value: 15 },
        ],
      },
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        default: "1080P",
        options: [
          { label: "720P", value: "720P" },
          { label: "1080P", value: "1080P" },
        ],
      },
    ],
  },
  {
    id: "wan2.7-i2v",
    name: "万相 2.7 图生视频",
    provider: "aliyun-bailian",
    capabilities: ["ai.image-to-video"],
    capabilityKeys: { "ai.image-to-video": 30 },
    fields: [
      {
        key: "duration",
        label: "时长（秒）",
        type: "select",
        default: 5,
        options: [
          { label: "5 秒", value: 5 },
          { label: "10 秒", value: 10 },
          { label: "15 秒", value: 15 },
        ],
      },
      {
        key: "resolution",
        label: "分辨率",
        type: "select",
        default: "720P",
        options: [
          { label: "720P", value: "720P" },
          { label: "1080P", value: "1080P" },
        ],
      },
    ],
  },
];

export const modelsForCapability = (kind: string) =>
  aiModelCatalog.filter((model) => model.capabilities.includes(kind));
