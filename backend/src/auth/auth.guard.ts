import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import type { AuthRequest } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  /** 校验 Cookie 会话及版本号，并把当前用户挂载到请求对象。 */
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.cookies?.ck_session;
    if (!token) throw new UnauthorizedException("请先登录");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { pointAccount: true } } },
    });
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.version !== session.user.sessionVersion
    ) {
      if (session)
        await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new UnauthorizedException("登录已在其他设备失效");
    }
    request.sessionId = session.id;
    request.user = {
      id: session.user.id,
      nickname: session.user.nickname,
      avatarUrl: session.user.avatarUrl,
      roles: session.user.roles,
      points: session.user.pointAccount?.balance ?? 0,
      sessionVersion: session.user.sessionVersion,
    };
    return true;
  }
}
