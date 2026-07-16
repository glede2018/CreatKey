import { BadRequestException, Injectable } from "@nestjs/common";
import { LedgerType } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 在执行工作流前预扣并冻结预计需要的 Keys。 */
  async reserve(userId: string, runId: string, amount: number) {
    if (amount <= 0) return;
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.pointAccount.findUniqueOrThrow({ where: { userId } });
      if (account.balance < amount) throw new BadRequestException(`Keys 不足，需要 ${amount} Keys`);
      const updated = await tx.pointAccount.update({
        where: { userId },
        data: { balance: { decrement: amount }, frozen: { increment: amount } },
      });
      await tx.pointReservation.create({ data: { userId, runId, amount } });
      await tx.pointLedger.create({
        data: {
          userId,
          type: LedgerType.RESERVE,
          amount: 0,
          balanceAfter: updated.balance,
          referenceId: runId,
          description: `工作流预冻结 ${amount} Keys`,
        },
      });
    });
  }

  /** 根据实际消费结算冻结 Keys，并退回未使用部分。 */
  async settle(runId: string, actual: number) {
    await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.pointReservation.findUnique({ where: { runId } });
      if (!reservation || reservation.settled || reservation.released) return;
      const consumed = Math.min(actual, reservation.amount);
      const released = reservation.amount - consumed;
      const before = await tx.pointAccount.findUniqueOrThrow({
        where: { userId: reservation.userId },
      });
      const updated = await tx.pointAccount.update({
        where: { userId: reservation.userId },
        data: { frozen: { decrement: reservation.amount }, balance: { increment: released } },
      });
      await tx.pointReservation.update({
        where: { id: reservation.id },
        data: { settled: consumed, released },
      });
      if (consumed)
        await tx.pointLedger.create({
          data: {
            userId: reservation.userId,
            type: LedgerType.CONSUME,
            amount: -consumed,
            balanceAfter: before.balance,
            referenceId: `${runId}:consume`,
            description: "工作流实际消费",
          },
        });
      if (released)
        await tx.pointLedger.create({
          data: {
            userId: reservation.userId,
            type: LedgerType.RELEASE,
            amount: released,
            balanceAfter: updated.balance,
            referenceId: `${runId}:release`,
            description: "释放未使用 Keys",
          },
        });
    });
  }

  /** 幂等地把已支付订单对应的 Keys 充入用户账户。 */
  async recharge(userId: string, orderId: string, keys: number) {
    await this.prisma.$transaction(async (tx) => {
      const exists = await tx.pointLedger.findUnique({
        where: { type_referenceId: { type: LedgerType.RECHARGE, referenceId: orderId } },
      });
      if (exists) return;
      const updated = await tx.pointAccount.update({
        where: { userId },
        data: { balance: { increment: keys } },
      });
      await tx.pointLedger.create({
        data: {
          userId,
          type: LedgerType.RECHARGE,
          amount: keys,
          balanceAfter: updated.balance,
          referenceId: orderId,
          description: "Keys 充值到账",
        },
      });
    });
  }

  /** 获取指定用户的 Keys 账户。 */
  account(userId: string) {
    return this.prisma.pointAccount.findUniqueOrThrow({ where: { userId } });
  }

  /** 获取指定用户最近 100 条 Keys 流水。 */
  ledger(userId: string) {
    return this.prisma.pointLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
