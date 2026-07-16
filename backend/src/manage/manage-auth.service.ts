import { Injectable, Logger, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PrismaService } from "../database/prisma.service";

const scrypt = promisify(scryptCallback);

@Injectable()
export class ManageAuthService implements OnModuleInit {
  private readonly logger = new Logger(ManageAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** 在空管理员表中按环境变量创建首个管理员，便于私有化部署初始化。 */
  async onModuleInit() {
    const count = await this.prisma.admin.count();
    if (count) return;
    const production = this.config.get("NODE_ENV") === "production";
    const username = this.config.get<string>("ADMIN_USERNAME", production ? "" : "admin").trim();
    const password = this.config.get<string>("ADMIN_PASSWORD", production ? "" : "CreatKey@2026");
    if (!username || !password) {
      this.logger.warn("管理员表为空，请配置 ADMIN_USERNAME 和 ADMIN_PASSWORD 后重启");
      return;
    }
    try {
      await this.prisma.admin.create({
        data: {
          username,
          displayName: this.config.get<string>("ADMIN_DISPLAY_NAME", "超级管理员"),
          passwordHash: await this.hashPassword(password),
        },
      });
    } catch (error) {
      // API 与 Worker 可能同时首次启动，唯一键冲突表示另一进程已完成初始化。
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"))
        throw error;
    }
    this.logger.log(`已初始化管理员账号 ${username}`);
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${hash.toString("hex")}`;
  }

  private async verifyPassword(password: string, encoded: string) {
    const [salt, storedHex] = encoded.split(":");
    if (!salt || !storedHex) return false;
    const stored = Buffer.from(storedHex, "hex");
    const candidate = (await scrypt(password, salt, stored.length)) as Buffer;
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  }

  private view(admin: { id: string; username: string; displayName: string }) {
    return { id: admin.id, username: admin.username, displayName: admin.displayName };
  }

  /** 校验独立管理员账号密码并创建单设备后台会话。 */
  async login(usernameValue?: string, passwordValue?: string) {
    const username = usernameValue?.trim();
    const password = passwordValue ?? "";
    if (!username || !password) throw new UnauthorizedException("请输入管理员账号和密码");
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (!admin || !admin.active || !(await this.verifyPassword(password, admin.passwordHash)))
      throw new UnauthorizedException("管理员账号或密码错误");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const ttlHours = Number(this.config.get("ADMIN_SESSION_TTL_HOURS", 12));
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.admin.update({
        where: { id: admin.id },
        data: { sessionVersion: { increment: 1 }, lastLoginAt: new Date() },
      });
      await tx.adminSession.deleteMany({ where: { adminId: admin.id } });
      await tx.adminSession.create({
        data: {
          adminId: admin.id,
          tokenHash,
          version: current.sessionVersion,
          expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
        },
      });
      return current;
    });
    return { token, admin: this.view(updated), ttlHours };
  }

  logout(sessionId: string) {
    return this.prisma.adminSession.delete({ where: { id: sessionId } }).catch(() => undefined);
  }
}
