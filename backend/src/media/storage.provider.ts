export const MEDIA_STORAGE = Symbol("MEDIA_STORAGE");

/** 媒体存储最小契约；上线时可用 OSS 实现替换本地实现。 */
export interface MediaStorageProvider {
  write(id: string, data: Buffer): Promise<void>;
  read(id: string): Promise<Buffer>;
  exists(id: string): Promise<boolean>;
}

