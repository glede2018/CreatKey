import { Injectable } from "@nestjs/common";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MediaStorageProvider } from "./storage.provider";

@Injectable()
export class LocalStorageProvider implements MediaStorageProvider {
  private readonly root = join(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? "uploads");

  async write(id: string, data: Buffer) {
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, id), data);
  }

  read(id: string) {
    return readFile(join(this.root, id));
  }

  async exists(id: string) {
    return Boolean(await stat(join(this.root, id)).catch(() => undefined));
  }
}

