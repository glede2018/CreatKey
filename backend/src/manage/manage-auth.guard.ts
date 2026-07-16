import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import type { ManageAuthRequest } from "./manage-auth.types";

@Injectable()
export class ManageAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  /** 校验与普通用户会话完全隔离的管理员 Cookie。 */
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ManageAuthRequest>();
    const token = request.cookies?.ck_manage_session;
    if (!token) throw new UnauthorizedException("请先登录运营后台");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { admin: true },
    });
    if (
      !session ||
      !session.admin.active ||
      session.expiresAt <= new Date() ||
      session.version !== session.admin.sessionVersion
    ) {
      if (session)
        await this.prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new UnauthorizedException("管理员登录已失效");
    }
    request.manageSessionId = session.id;
    request.manageAdmin = {
      id: session.admin.id,
      username: session.admin.username,
      displayName: session.admin.displayName,
    };
    return true;
  }
}
