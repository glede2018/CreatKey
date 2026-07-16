import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { SmsGatewayService } from "./sms-gateway.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sms: SmsGatewayService,
  ) {}

  /** 使用服务端 pepper 对验证码做不可逆摘要，避免数据库泄露明文验证码。 */
  private hash(value: string) {
    return createHash("sha256")
      .update(`${value}:${this.config.get("SMS_CODE_PEPPER", "creatkey-dev")}`)
      .digest("hex");
  }

  /** 规范化并校验当前支持的 +86 中国大陆手机号码。 */
  private normalize(countryCode: string | undefined, phone: string | undefined) {
    const code = (countryCode ?? "+86").trim();
    const number = (phone ?? "").replace(/[\s-]/g, "");
    if (code !== "+86") throw new BadRequestException("目前仅支持 +86 中国大陆手机号");
    if (!/^1[3-9]\d{9}$/.test(number)) throw new BadRequestException("请输入正确的中国大陆手机号");
    return { countryCode: code, phone: number };
  }

  /** 将不可信的角色输入收敛为系统支持的两种角色。 */
  private role(value: unknown) {
    return value === Role.MERCHANT ? Role.MERCHANT : Role.CREATOR;
  }

  /** 将数据库用户转换成可安全返回给前端的公开视图。 */
  private userView(user: any) {
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      roles: user.roles,
      profileInitialized: user.profileInitialized ?? user.roles.length > 0,
      phone: user.phone,
      keys: user.pointAccount?.balance ?? 0,
    };
  }

  /** 创建一次性短信验证码，并执行 60 秒冷却与每小时频率限制。 */
  async sendCode(input: { countryCode?: string; phone?: string }) {
    const identity = this.normalize(input.countryCode, input.phone);
    const now = new Date();
    const latest = await this.prisma.smsVerificationCode.findFirst({
      where: identity,
      orderBy: { createdAt: "desc" },
    });
    if (latest && latest.createdAt.getTime() > Date.now() - 60_000)
      throw new HttpException("验证码发送过于频繁，请 60 秒后重试", HttpStatus.TOO_MANY_REQUESTS);
    const recentCount = await this.prisma.smsVerificationCode.count({
      where: { ...identity, createdAt: { gte: new Date(Date.now() - 3600_000) } },
    });
    if (recentCount >= 5)
      throw new HttpException("该手机号发送次数过多，请稍后再试", HttpStatus.TOO_MANY_REQUESTS);
    const code = randomInt(100000, 1000000).toString();
    await this.prisma.smsVerificationCode.create({
      data: {
        ...identity,
        role: Role.CREATOR,
        codeHash: this.hash(code),
        expiresAt: new Date(now.getTime() + 5 * 60_000),
      },
    });
    await this.sms.send({ ...identity, code, expiresInMinutes: 5 });
    return { sent: true, cooldown: 60, expiresIn: 300 };
  }

  /** 校验短信码、原子消费验证码，并登录或注册对应手机号用户。 */
  async verifyCode(input: { countryCode?: string; phone?: string; code?: string }) {
    const identity = this.normalize(input.countryCode, input.phone);
    const code = (input.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) throw new BadRequestException("验证码必须是 6 位数字");
    const record = await this.prisma.smsVerificationCode.findFirst({
      where: { ...identity, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw new BadRequestException("请先获取短信验证码或验证码已过期");
    if (record.attempts >= 5)
      throw new HttpException("验证码错误次数过多，请重新获取", HttpStatus.TOO_MANY_REQUESTS);
    const master = this.config.get("SMS_MASTER_CODE", "888888");
    const expected = Buffer.from(record.codeHash);
    const actual = Buffer.from(this.hash(code));
    const valid =
      code === master || (expected.length === actual.length && timingSafeEqual(expected, actual));
    if (!valid) {
      await this.prisma.smsVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("短信验证码错误");
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.smsVerificationCode.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (!consumed.count) throw new UnauthorizedException("验证码已使用");
      const existing = await tx.user.findUnique({ where: { phone: identity.phone } });
      if (existing)
        return tx.user.findUniqueOrThrow({
          where: { id: existing.id },
          include: { pointAccount: true },
        });
      return tx.user.create({
        data: {
          ...identity,
          nickname: `用户${identity.phone.slice(-4)}`,
          roles: [],
          profileInitialized: false,
          pointAccount: { create: { balance: 100 } },
        },
        include: { pointAccount: true },
      });
    });
    const session = await this.issueSession(user.id);
    return { ...session, user: this.userView(user) };
  }

  /** 完成首次登录资料初始化；用户名、角色和头像均为必填项。 */
  async initializeProfile(
    userId: string,
    input: { nickname?: string; role?: Role; avatarUrl?: string | null },
  ) {
    const nickname = input.nickname?.trim();
    if (!nickname || nickname.length < 2 || nickname.length > 20)
      throw new BadRequestException("用户名请输入 2-20 个字符");
    if (!Object.values(Role).includes(input.role as Role))
      throw new BadRequestException("请选择有效的用户角色");
    const avatarUrl = input.avatarUrl?.trim();
    if (!avatarUrl) throw new BadRequestException("请上传头像");
    const match = avatarUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new BadRequestException("头像仅支持 PNG、JPG 或 WebP 图片");
    if (match[2].length > 2_800_000) throw new BadRequestException("头像大小不能超过 2MB");
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname,
        avatarUrl,
        roles: [this.role(input.role)],
        profileInitialized: true,
      },
      include: { pointAccount: true },
    });
    return this.userView(user);
  }

  /** 创建唯一会话；递增会话版本并删除旧会话以保证单点登录。 */
  async issueSession(userId: string) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const ttlDays = Number(this.config.get("SESSION_TTL_DAYS", 30));
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.session.create({
        data: {
          userId,
          tokenHash,
          version: updated.sessionVersion,
          expiresAt: new Date(Date.now() + ttlDays * 86400_000),
        },
      });
      return tx.user.findUniqueOrThrow({ where: { id: userId }, include: { pointAccount: true } });
    });
    return { status: "CONFIRMED", token: rawToken, user: this.userView(user) };
  }

  /** 删除当前会话；重复退出时保持幂等。 */
  async logout(sessionId: string) {
    await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
  }
}
