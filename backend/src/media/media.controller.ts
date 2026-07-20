import { BadRequestException, Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { MediaService } from "./media.service";

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload")
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 500 * 1024 * 1024 } }))
  upload(@UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    if (!file) throw new BadRequestException("请选择文件");
    return this.media.saveUpload(file);
  }

  @Get(":id")
  async get(@Param("id") id: string, @Res() response: Response) {
    const buffer = await this.media.read(id);
    const extension = extMime(id);
    response.setHeader("Content-Type", extension);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.send(buffer);
  }
}

const extMime = (id: string) => {
  const ext = id.split(".").pop()?.toLowerCase();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" } as Record<string, string>)[ext ?? ""] ?? "application/octet-stream";
};
