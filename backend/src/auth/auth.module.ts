import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { SmsGatewayService } from "./sms-gateway.service";
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, SmsGatewayService],
  exports: [AuthGuard],
})
export class AuthModule {}
