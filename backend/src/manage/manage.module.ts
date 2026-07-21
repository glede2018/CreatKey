import { Module } from "@nestjs/common";
import { MediaModule } from "../media/media.module";
import { ManageController } from "./manage.controller";
import { ManageAuthController } from "./manage-auth.controller";
import { ManageAuthGuard } from "./manage-auth.guard";
import { ManageAuthService } from "./manage-auth.service";
import { ManageService } from "./manage.service";

@Module({
  imports: [MediaModule],
  controllers: [ManageController, ManageAuthController],
  providers: [ManageService, ManageAuthService, ManageAuthGuard],
})
export class ManageModule {}
