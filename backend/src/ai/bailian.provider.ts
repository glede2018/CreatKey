import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import OpenAI from "openai";
import { MediaService } from "../media/media.service";
import type { MediaAsset } from "../media/media.types";
import type { AiProvider } from "./ai-provider";

type NodeValue = { type?: string; value?: string; assets?: MediaAsset[] } | null | undefined;
type RoutedInput = { targetHandle?: string | null; value: NodeValue };

const ratioToImageSize: Record<string, string> = {
  "16:9": "2688*1536",
  "9:16": "1536*2688",
  "1:1": "2048*2048",
  "4:3": "2368*1728",
  "3:4": "1728*2368",
};
@Injectable()
export class BailianProvider implements AiProvider {
  readonly id = "aliyun-bailian";
  constructor(private readonly media: MediaService) {}

  private client() {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException("尚未配置 DASHSCOPE_API_KEY");
    return new OpenAI({
      apiKey,
      baseURL: process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
      timeout: 10 * 60 * 1000,
    });
  }

  private apiRoot() {
    if (process.env.DASHSCOPE_API_BASE_URL) return process.env.DASHSCOPE_API_BASE_URL.replace(/\/$/, "");
    const compatible = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
    return compatible.replace(/\/compatible-mode\/v1\/?$/, "/api/v1").replace(/\/$/, "");
  }

  private apiKey() {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException("尚未配置 DASHSCOPE_API_KEY");
    return apiKey;
  }

  async execute(kind: string, model: string, config: Record<string, unknown>, inputs: RoutedInput[]) {
    if (kind === "ai.speech-to-text") return this.speechToText(model, config, inputs);
    if (kind === "ai.multimodal-to-text") return this.multimodalToText(model, config, inputs);
    if (["ai.text-to-image", "ai.image-to-image", "ai.multi-image-to-image"].includes(kind))
      return this.generateImage(model, config, inputs);
    if (kind === "ai.text-to-speech") return this.textToSpeech(model, config, inputs);
    if (kind === "ai.music-generation") return this.generateMusic(model, config, inputs);
    if (["ai.text-to-video", "ai.image-to-video"].includes(kind))
      return this.generateVideo(kind, model, config, inputs);
    throw new Error(`尚未实现节点能力：${kind}`);
  }

  private texts(config: Record<string, unknown>, inputs: RoutedInput[]) {
    const upstream = inputs
      .map((input) => input.value)
      .filter((value): value is NonNullable<NodeValue> => value?.type === "text")
      .map((value) => String(value.value ?? ""))
      .filter(Boolean);
    const manual = [config.prompt, config.text].map((value) => String(value ?? "").trim()).filter(Boolean);
    return [...upstream, ...manual];
  }

  private assets(inputs: RoutedInput[], type: MediaAsset["type"]) {
    return inputs
      .flatMap((input) => input.value?.assets ?? [])
      .filter((asset) => asset.type === type);
  }

  private async speechToText(model: string, config: Record<string, unknown>, inputs: RoutedInput[]) {
    const audio = this.assets(inputs, "audio")[0] ?? (config.media as MediaAsset | undefined);
    if (!audio) throw new Error("语音识别节点缺少音频输入");
    const data = await this.media.dataUrl(audio);
    const completion = await this.client().chat.completions.create({
      model,
      messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data } }] } as any],
      stream: false,
      extra_body: {
        asr_options: {
          ...(config.language && config.language !== "auto" ? { language: config.language } : {}),
          enable_itn: Boolean(config.enableItn ?? true),
        },
      },
    } as any);
    return { type: "text", value: completion.choices[0]?.message?.content ?? "", model };
  }

  private async multimodalToText(model: string, config: Record<string, unknown>, inputs: RoutedInput[]) {
    const content: any[] = this.texts(config, inputs).map((text) => ({ type: "text", text }));
    for (const image of this.assets(inputs, "image"))
      content.push({ type: "image_url", image_url: { url: await this.media.dataUrl(image) } });
    for (const image of ((config.images as MediaAsset[] | undefined) ?? []))
      content.push({ type: "image_url", image_url: { url: await this.media.dataUrl(image) } });
    if (!content.length) throw new Error("多模态转文本节点至少需要文本或图片");
    const messages: any[] = [];
    if (config.systemPrompt) messages.push({ role: "system", content: String(config.systemPrompt) });
    messages.push({ role: "user", content });
    const completion = await this.client().chat.completions.create({
      model,
      messages,
      temperature: Number(config.temperature ?? 0.7),
      max_tokens: Number(config.maxTokens ?? 2048),
    });
    return { type: "text", value: completion.choices[0]?.message?.content ?? "", model };
  }

  private async generateImage(model: string, config: Record<string, unknown>, inputs: RoutedInput[]) {
    const content: Array<Record<string, string>> = [];
    for (const image of this.assets(inputs, "image")) content.push({ image: await this.media.dataUrl(image) });
    for (const image of ((config.images as MediaAsset[] | undefined) ?? []))
      content.push({ image: await this.media.dataUrl(image) });
    const prompt = this.texts(config, inputs).join("\n");
    if (!prompt && !content.length) throw new Error("图片生成节点缺少提示词或参考图");
    if (prompt) content.push({ text: prompt });
    const response = await this.post("/services/aigc/multimodal-generation/generation", {
      model,
      input: { messages: [{ role: "user", content }] },
      parameters: {
        size: ratioToImageSize[String(config.ratio ?? "1:1")] ?? String(config.size ?? "2048*2048"),
        n: Number(config.count ?? 1),
        negative_prompt: String(config.negativePrompt ?? ""),
        prompt_extend: Boolean(config.promptExtend ?? true),
        watermark: false,
      },
    });
    const urls = this.mediaUrls(response, "image");
    if (!urls.length) throw new Error("百炼图片模型未返回图片地址");
    const assets = await Promise.all(urls.map((url) => this.media.importRemote(url, "image")));
    return { type: "image", assets, model, prompt };
  }

  private async textToSpeech(model: string, config: Record<string, unknown>, inputs: RoutedInput[]) {
    const text = this.texts(config, inputs).join("\n");
    if (!text) throw new Error("文字转语音节点缺少文本");
    const response = await this.post("/services/aigc/multimodal-generation/generation", {
      model,
      input: { text, voice: String(config.voice ?? "Cherry"), language_type: String(config.languageType ?? "Auto") },
    });
    const urls = this.mediaUrls(response, "audio");
    if (!urls.length) throw new Error("百炼语音模型未返回音频地址");
    const assets = await Promise.all(urls.map((url) => this.media.importRemote(url, "audio")));
    return { type: "audio", assets, model };
  }

  private async generateMusic(model: string, config: Record<string, unknown>, inputs: RoutedInput[]) {
    const prompt = this.texts(config, inputs).join("\n");
    if (!prompt) throw new Error("音乐生成节点缺少提示词");
    const result = await this.post("/services/audio/music/generation", {
      model,
      input: {
        prompt,
        ...(config.lyrics ? { lyrics: String(config.lyrics) } : {}),
        is_instrumental: Boolean(config.instrumental ?? true),
        gender: String(config.gender ?? "female"),
        format: String(config.format ?? "mp3"),
        enable_aigc_watermark: false,
      },
    });
    const urls = this.mediaUrls(result, "audio");
    if (!urls.length) throw new Error("百炼音乐模型未返回音频地址");
    const assets = await Promise.all(urls.map((url) => this.media.importRemote(url, "audio")));
    return { type: "audio", assets, model, prompt };
  }

  private async generateVideo(kind: string, model: string, config: Record<string, unknown>, inputs: RoutedInput[]) {
    const prompt = this.texts(config, inputs).join("\n");
    const image = this.assets(inputs, "image")[0] ?? (config.media as MediaAsset | undefined);
    if (kind === "ai.image-to-video" && !image) throw new Error("图生视频节点缺少图片");
    if (kind === "ai.text-to-video" && !prompt) throw new Error("文生视频节点缺少提示词");
    const mediaUrl = image?.url;
    if (image && /https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(mediaUrl ?? ""))
      throw new Error("百炼图生视频需要可公网访问的图片 URL；请配置 PUBLIC_API_URL，后续切换 OSS 后无需此限制");
    const task = await this.post("/services/aigc/video-generation/video-synthesis", {
      model,
      input: {
        prompt,
        ...(image ? { media: [{ type: "first_frame", url: mediaUrl }] } : {}),
      },
      parameters: {
        ...(kind === "ai.text-to-video" ? { ratio: String(config.ratio ?? "16:9") } : {}),
        duration: Number(config.duration ?? 5),
        resolution: String(config.resolution ?? "720P"),
        prompt_extend: true,
        watermark: false,
      },
    }, true);
    const result = await this.waitTask(String((task as any)?.output?.task_id ?? ""));
    const urls = this.mediaUrls(result, "video");
    if (!urls.length) throw new Error("百炼视频模型未返回视频地址");
    const assets = await Promise.all(urls.map((url) => this.media.importRemote(url, "video")));
    return { type: "video", assets, model, prompt };
  }

  private async post(path: string, body: unknown, asyncTask = false) {
    const response = await fetch(`${this.apiRoot()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey()}`,
        "Content-Type": "application/json",
        ...(asyncTask ? { "X-DashScope-Async": "enable" } : {}),
      },
      body: JSON.stringify(body),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok || (value as any)?.code)
      throw new Error((value as any)?.message ?? `百炼请求失败（${response.status}）`);
    return value;
  }

  private async waitTask(taskId: string) {
    if (!taskId) throw new Error("百炼没有返回任务 ID");
    const deadline = Date.now() + 12 * 60 * 1000;
    while (Date.now() < deadline) {
      const response = await fetch(`${this.apiRoot()}/tasks/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${this.apiKey()}` },
      });
      const value = await response.json().catch(() => ({}));
      const status = String((value as any)?.output?.task_status ?? "");
      if (status === "SUCCEEDED") return value;
      if (["FAILED", "CANCELED", "UNKNOWN"].includes(status))
        throw new Error((value as any)?.output?.message ?? (value as any)?.message ?? `百炼任务${status}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("百炼任务等待超时");
  }

  private mediaUrls(value: unknown, type: MediaAsset["type"]) {
    const urls = new Set<string>();
    const visit = (item: unknown, key = "") => {
      if (typeof item === "string" && /^https?:\/\//.test(item)) {
        if (key.includes(type) || key === "url" || key.endsWith("_url")) urls.add(item);
        return;
      }
      if (Array.isArray(item)) return item.forEach((entry) => visit(entry, key));
      if (item && typeof item === "object")
        Object.entries(item).forEach(([childKey, child]) => visit(child, childKey.toLowerCase()));
    };
    visit(value);
    return [...urls];
  }
}
