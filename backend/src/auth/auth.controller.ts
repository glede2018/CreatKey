import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import type { AuthRequest, AuthUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 将服务端会话令牌写入不可被前端脚本读取的 Cookie。 */
  private setSession(response: Response, result: any) {
    response.cookie("ck_session", result.token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: Number(process.env.SESSION_TTL_DAYS ?? 30) * 86400_000,
    });
    return result.user;
  }

  /** 请求发送手机短信验证码。 */
  @Post("sms/send") send(@Body() body: any) {
    return this.auth.sendCode(body);
  }

  /** 校验短信验证码并建立登录会话。 */
  @Post("sms/verify") async verify(
    @Body() body: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.setSession(response, await this.auth.verifyCode(body));
  }

  /** 返回当前登录用户信息。 */
  @Get("me") @UseGuards(AuthGuard) me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /** 保存首次登录时填写的用户名、角色与头像。 */
  @Patch("profile") @UseGuards(AuthGuard) initializeProfile(
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ) {
    return this.auth.initializeProfile(user.id, body);
  }

  /** 注销当前设备的登录会话并清理 Cookie。 */
  @Post("logout") @UseGuards(AuthGuard) async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.sessionId);
    response.clearCookie("ck_session", { path: "/" });
  }
}
