import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ManageAuthGuard } from "./manage-auth.guard";
import { ManageAuthService } from "./manage-auth.service";
import type { ManageAuthRequest } from "./manage-auth.types";

@Controller("manage-auth")
export class ManageAuthController {
  constructor(private readonly auth: ManageAuthService) {}

  @Post("login") async login(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body.username, body.password);
    response.cookie("ck_manage_session", result.token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: result.ttlHours * 3_600_000,
    });
    return result.admin;
  }

  @Get("me") @UseGuards(ManageAuthGuard) me(@Req() request: ManageAuthRequest) {
    return request.manageAdmin;
  }

  @Post("logout") @UseGuards(ManageAuthGuard) async logout(
    @Req() request: ManageAuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.manageSessionId);
    response.clearCookie("ck_manage_session", { path: "/" });
  }
}
