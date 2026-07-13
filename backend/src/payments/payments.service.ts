import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerType, PaymentChannel, PaymentStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { PrismaService } from "../database/prisma.service";
import { PaymentGatewayService } from "./payment-gateway.service";

const packs = new Map([
  [100, 1000],
  [550, 5000],
  [1200, 10000],
]);
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  /** 校验充值套餐、创建订单并生成供前端展示的二维码。 */
  async create(userId: string, body: { points?: number; channel?: PaymentChannel }) {
    const points = Number(body.points);
    const amountFen = packs.get(points);
    if (!amountFen) throw new BadRequestException("充值套餐无效");
    const channel =
      body.channel === PaymentChannel.ALIPAY ? PaymentChannel.ALIPAY : PaymentChannel.WECHAT;
    const orderNo = `CK${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
    const order = await this.prisma.paymentOrder.create({
      data: {
        orderNo,
        userId,
        channel,
        amountFen,
        points,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    const base = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}/api`;
    const notifyUrl =
      channel === PaymentChannel.WECHAT
        ? `${base}/payments/wechat/notify`
        : `${base}/payments/alipay/notify`;
    try {
      const qrUrl = await this.gateway.create(channel, {
        orderNo,
        amountFen,
        description: `CreatKey ${points} 点`,
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

  /** 幂等完成订单、记录支付事件并为用户增加点数。 */
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
        data: { balance: { increment: current.points } },
      });
      await tx.pointLedger.create({
        data: {
          userId: current.userId,
          type: LedgerType.RECHARGE,
          amount: current.points,
          balanceAfter: account.balance,
          referenceId: current.id,
          description: `${current.channel}充值`,
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
