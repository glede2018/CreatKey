import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { AssetSource } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { MediaAsset } from "./media.types";
import { MEDIA_STORAGE, type MediaStorageProvider } from "./storage.provider";

const mediaType = (mimeType: string): MediaAsset["type"] | undefined => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
};

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorageProvider,
    private readonly prisma: PrismaService,
  ) {}

  private publicUrl(id: string) {
    const base = (process.env.PUBLIC_API_URL ?? "http://localhost:3000/api").replace(/\/$/, "");
    return `${base}/media/${id}`;
  }

  async saveUpload(
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    ownerId?: string,
  ) {
    const type = mediaType(file.mimetype);
    if (!type) throw new BadRequestException("只支持图片、音频或视频文件");
    const limits = { image: 20, audio: 100, video: 500 } as const;
    if (file.size > limits[type] * 1024 * 1024)
      throw new BadRequestException(
        `${type === "image" ? "图片" : type === "audio" ? "音频" : "视频"}不能超过 ${limits[type]}MB`,
      );
    const suffix =
      extname(file.originalname)
        .toLowerCase()
        .replace(/[^.a-z0-9]/g, "") ||
      (
        {
          "image/png": ".png",
          "image/jpeg": ".jpg",
          "audio/mpeg": ".mp3",
          "audio/wav": ".wav",
          "video/mp4": ".mp4",
        } as Record<string, string>
      )[file.mimetype] ||
      ".bin";
    const id = `${randomUUID()}${suffix}`;
    await this.storage.write(id, file.buffer);
    await this.prisma.assetFile.create({
      data: {
        id,
        ownerId,
        originalName: file.originalname,
        mediaType: type,
        mimeType: file.mimetype,
        size: file.size,
        source: AssetSource.UPLOAD,
      },
    });
    return this.asset(id, file.originalname, file.mimetype, file.size, type);
  }

  async saveGenerated(buffer: Buffer, mimeType: string, extension: string) {
    const type = mediaType(mimeType);
    if (!type) throw new BadRequestException("模型返回了不支持的媒体类型");
    const id = `${randomUUID()}.${extension.replace(/^\./, "")}`;
    await this.storage.write(id, buffer);
    await this.prisma.assetFile.create({
      data: {
        id,
        originalName: `AI-${id}`,
        mediaType: type,
        mimeType,
        size: buffer.length,
        source: AssetSource.AI_GENERATED,
      },
    });
    return this.asset(id, `AI-${id}`, mimeType, buffer.length, type);
  }

  async importRemote(url: string, fallbackType: MediaAsset["type"]) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`下载模型结果失败（${response.status}）`);
    const mimeType =
      response.headers.get("content-type")?.split(";")[0] ||
      (fallbackType === "image"
        ? "image/png"
        : fallbackType === "audio"
          ? "audio/mpeg"
          : "video/mp4");
    const extension = mimeType.split("/")[1]?.replace("mpeg", "mp3") ?? fallbackType;
    return this.saveGenerated(Buffer.from(await response.arrayBuffer()), mimeType, extension);
  }

  async read(id: string) {
    if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(id)) throw new NotFoundException("文件不存在");
    try {
      return await this.storage.read(id);
    } catch {
      throw new NotFoundException("文件不存在");
    }
  }

  async dataUrl(asset: Partial<MediaAsset> & { id?: string; url?: string; mimeType?: string }) {
    if (asset.id) {
      const buffer = await this.read(asset.id);
      return `data:${asset.mimeType ?? "application/octet-stream"};base64,${buffer.toString("base64")}`;
    }
    if (asset.url?.startsWith("data:")) return asset.url;
    if (!asset.url) throw new Error("媒体资源缺少地址");
    return asset.url;
  }

  private asset(
    id: string,
    name: string,
    mimeType: string,
    size: number,
    type: MediaAsset["type"],
  ): MediaAsset {
    return { id, name, type, mimeType, size, url: this.publicUrl(id) };
  }

  publicAsset(file: {
    id: string;
    originalName: string;
    mediaType: string;
    mimeType: string;
    size: number;
  }): MediaAsset {
    return this.asset(
      file.id,
      file.originalName,
      file.mimeType,
      file.size,
      file.mediaType as MediaAsset["type"],
    );
  }

  async info(id: string) {
    if (!(await this.storage.exists(id))) throw new NotFoundException("文件不存在");
    return { id };
  }
}
