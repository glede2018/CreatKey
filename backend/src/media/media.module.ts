import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { LocalStorageProvider } from "./local-storage.provider";
import { MEDIA_STORAGE } from "./storage.provider";

@Module({
  controllers: [MediaController],
  providers: [MediaService, { provide: MEDIA_STORAGE, useClass: LocalStorageProvider }],
  exports: [MediaService],
})
export class MediaModule {}
