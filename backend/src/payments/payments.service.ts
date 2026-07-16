import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerType, PaymentChannel, PaymentStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { PrismaService } from "../database/prisma.service";
import { PaymentGatewayService } from "./payment-gateway.service";

const defaultPackages = [
  { code: "starter", name: "轻量包", keys: 100, amountFen: 1000, sortOrder: 10 },
  { code: "popular", name: "常用包", keys: 550, amountFen: 5000, sortOrder: 20 },
  { code: "pro", name: "进阶包", keys: 1200, amountFen: 10000, sortOrder: 30 },
];
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  /** 首次使用时创建默认套餐，之后完全由 manage 后台维护。 */
  private async ensurePackages() {
    if (await this.prisma.rechargePackage.count()) return;
    await this.prisma.rechargePackage.createMany({ data: defaultPackages, skipDuplicates: true });
  }

  /** 返回面向用户的已启用套餐。 */
  async packages() {
    await this.ensurePackages();
    return this.prisma.rechargePackage.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { amountFen: "asc" }],
      select: { id: true, name: true, keys: true, amountFen: true },
    });
  }

  /** 校验充值套餐、创建微信 Native 订单并生成供前端展示的二维码。 */
  async create(userId: string, body: { packageId?: string }) {
    const rechargePackage = await this.prisma.rechargePackage.findFirst({
      where: { id: body.packageId, active: true },
    });
    if (!rechargePackage) throw new BadRequestException("Keys 充值套餐无效或已下架");
    const channel = PaymentChannel.WECHAT;
    const orderNo = `CK${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
    const order = await this.prisma.paymentOrder.create({
      data: {
        orderNo,
        userId,
        channel,
        amountFen: rechargePackage.amountFen,
        keys: rechargePackage.keys,
        packageId: rechargePackage.id,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    const base = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
    const notifyUrl = `${base}/payments/wechat/notify`;
    try {
      const qrUrl = await this.gateway.create(channel, {
        orderNo,
        amountFen: rechargePackage.amountFen,
        description: `CreatKey ${rechargePackage.keys} Keys`,
        notifyUrl,
      });
      const saved = await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { qrUrl },
      });
      return {
        ...saved,
        qrImage: await QRCode.toDataURL(qrUrl, { margin: 1, width: 320 }),
        mock: this.gateway.isMock(),
      };
    } catch (error) {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: PaymentStatus.CLOSED },
      });
      throw error;
    }
  }

  /** 查询属于用户的订单，并按需重新生成二维码图片。 */
  async get(id: string, userId: string) {
    const order = await this.prisma.paymentOrder.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException("支付订单不存在");
    return {
      ...order,
      qrImage: order.qrUrl ? await QRCode.toDataURL(order.qrUrl, { margin: 1, width: 320 }) : "",
      mock: this.gateway.isMock(),
    };
  }

  /** 在 mock 模式下模拟第三方支付成功通知。 */
  async devConfirm(id: string, userId: string) {
    if (!this.gateway.isMock()) throw new BadRequestException("非模拟支付模式");
    const order = await this.get(id, userId);
    return this.complete(order.orderNo, `mock-${id}`, { source: "mock" });
  }

  /** 用户主动取消支付，并同步关闭微信侧待支付订单。 */
  async cancel(id: string, userId: string) {
    const order = await this.prisma.paymentOrder.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException("支付订单不存在");
    if (order.status === PaymentStatus.PAID) throw new BadRequestException("订单已支付，无法取消");
    if (order.status === PaymentStatus.CLOSED) return order;
    await this.gateway.cancel(order.channel, order.orderNo);
    await this.prisma.paymentOrder.updateMany({
      where: { id: order.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.CLOSED },
    });
    return this.prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
  }

  /** 幂等完成订单、记录支付事件并为用户增加 Keys。 */
  async complete(orderNo: string, tradeNo: string, payload: Record<string, unknown>) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { orderNo } });
    if (!order) throw new NotFoundException("订单不存在");
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
      if (current.status === PaymentStatus.PAID) return current;
      const eventKey = `${current.channel}:${tradeNo}`;
      await tx.paymentEvent.create({
        data: { orderId: current.id, eventKey, payload: payload as any },
      });
      const updatedOrder = await tx.paymentOrder.update({
        where: { id: current.id },
        data: { status: PaymentStatus.PAID, providerTradeNo: tradeNo, paidAt: new Date() },
      });
      const account = await tx.pointAccount.update({
        where: { userId: current.userId },
        data: { balance: { increment: current.keys } },
      });
      await tx.pointLedger.create({
        data: {
          userId: current.userId,
          type: LedgerType.RECHARGE,
          amount: current.keys,
          balanceAfter: account.balance,
          referenceId: current.id,
          description: `${current.channel} Keys 充值`,
        },
      });
      return updatedOrder;
    });
  }

  /** 暴露网关实例供控制器完成第三方通知验签与解密。 */
  gatewayService() {
    return this.gateway;
  }
}
