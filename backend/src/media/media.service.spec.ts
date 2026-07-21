import { describe, expect, it } from "vitest";
import type { PrismaService } from "../database/prisma.service";
import { MediaService } from "./media.service";
import type { MediaStorageProvider } from "./storage.provider";

class MemoryStorage implements MediaStorageProvider {
  files = new Map<string, Buffer>();
  async write(id: string, data: Buffer) {
    this.files.set(id, data);
  }
  async read(id: string) {
    const value = this.files.get(id);
    if (!value) throw new Error("missing");
    return value;
  }
  async exists(id: string) {
    return this.files.has(id);
  }
}

const prisma = {
  assetFile: { create: async () => ({}) },
} as unknown as PrismaService;

describe("MediaService", () => {
  it("stores supported uploads and can expose them as data URLs", async () => {
    const storage = new MemoryStorage();
    const service = new MediaService(storage, prisma);
    const asset = await service.saveUpload({
      originalname: "reference.png",
      mimetype: "image/png",
      size: 3,
      buffer: Buffer.from("png"),
    });
    expect(asset.type).toBe("image");
    expect(asset.id).toMatch(/\.png$/);
    expect(await service.dataUrl(asset)).toBe("data:image/png;base64,cG5n");
  });

  it("rejects unsupported file types", async () => {
    const service = new MediaService(new MemoryStorage(), prisma);
    await expect(
      service.saveUpload({
        originalname: "notes.txt",
        mimetype: "text/plain",
        size: 3,
        buffer: Buffer.from("txt"),
      }),
    ).rejects.toThrow(/只支持图片、音频或视频/);
  });
});
