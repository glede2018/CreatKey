import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerType, PaymentStatus, Prisma, Role, RunStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";

const DAY = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

@Injectable()
export class ManageService {
  constructor(private readonly prisma: PrismaService) {}

  /** 汇总全站核心指标与最近七天趋势。 */
  async overview() {
    const today = startOfDay(new Date());
    const since = new Date(today.getTime() - 6 * DAY);
    const [
      users,
      workflows,
      runs,
      successfulRuns,
      paid,
      todayUsers,
      recentUsers,
      recentRuns,
      recentPaid,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.workflow.count(),
      this.prisma.workflowRun.count(),
      this.prisma.workflowRun.count({ where: { status: RunStatus.SUCCEEDED } }),
      this.prisma.paymentOrder.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amountFen: true },
        _count: true,
      }),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.workflowRun.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, status: true },
      }),
      this.prisma.paymentOrder.findMany({
        where: { status: PaymentStatus.PAID, paidAt: { gte: since } },
        select: { paidAt: true, amountFen: true },
      }),
    ]);
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(since.getTime() + index * DAY);
      const key = dateKey(date);
      return {
        date: key,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        users: recentUsers.filter((item) => dateKey(item.createdAt) === key).length,
        runs: recentRuns.filter((item) => dateKey(item.createdAt) === key).length,
        successfulRuns: recentRuns.filter(
          (item) => dateKey(item.createdAt) === key && item.status === RunStatus.SUCCEEDED,
        ).length,
        revenueFen: recentPaid
          .filter((item) => item.paidAt && dateKey(item.paidAt) === key)
          .reduce((sum, item) => sum + item.amountFen, 0),
      };
    });
    return {
      metrics: {
        users,
        todayUsers,
        workflows,
        runs,
        successRate: runs ? Math.round((successfulRuns / runs) * 1000) / 10 : 0,
        revenueFen: paid._sum.amountFen ?? 0,
        paidOrders: paid._count,
      },
      trend,
    };
  }

  /** 分页检索用户，并附带余额及内容数量。 */
  async users(query = "", pageValue = 1) {
    const page = Math.max(1, Number(pageValue) || 1);
    const pageSize = 12;
    const where: Prisma.UserWhereInput = query.trim()
      ? {
          OR: [
            { nickname: { contains: query.trim(), mode: "insensitive" } },
            { phone: { contains: query.trim() } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          nickname: true,
          phone: true,
          roles: true,
          createdAt: true,
          pointAccount: { select: { balance: true, frozen: true } },
          _count: { select: { workflows: true, runs: true, payments: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 查看全站工作流运行记录。 */
  async runs(status?: string, pageValue = 1) {
    const page = Math.max(1, Number(pageValue) || 1);
    const pageSize = 15;
    const parsedStatus = Object.values(RunStatus).includes(status as RunStatus)
      ? (status as RunStatus)
      : undefined;
    const where = parsedStatus ? { status: parsedStatus } : {};
    const [items, total] = await Promise.all([
      this.prisma.workflowRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
          workflow: { select: { id: true, name: true } },
          _count: { select: { nodeRuns: true } },
        },
      }),
      this.prisma.workflowRun.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 查看充值订单及对应用户。 */
  async payments(status?: string, pageValue = 1) {
    const page = Math.max(1, Number(pageValue) || 1);
    const pageSize = 15;
    const parsedStatus = Object.values(PaymentStatus).includes(status as PaymentStatus)
      ? (status as PaymentStatus)
      : undefined;
    const where = parsedStatus ? { status: parsedStatus } : {};
    const [items, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, nickname: true, phone: true } } },
      }),
      this.prisma.paymentOrder.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 获取 Keys 充值套餐；首次进入时写入一组可直接编辑的默认值。 */
  async rechargePackages() {
    if (!(await this.prisma.rechargePackage.count())) {
      await this.prisma.rechargePackage.createMany({
        data: [
          { code: "starter", name: "轻量包", keys: 100, amountFen: 1000, sortOrder: 10 },
          { code: "popular", name: "常用包", keys: 550, amountFen: 5000, sortOrder: 20 },
          { code: "pro", name: "进阶包", keys: 1200, amountFen: 10000, sortOrder: 30 },
        ],
        skipDuplicates: true,
      });
    }
    return this.prisma.rechargePackage.findMany({
      orderBy: [{ sortOrder: "asc" }, { amountFen: "asc" }],
    });
  }

  /** 新增一个可在价目表展示的 Keys 套餐。 */
  async createRechargePackage(body: Record<string, unknown>) {
    const data = this.rechargePackageInput(body);
    return this.prisma.rechargePackage.create({
      data: { ...data, code: `custom-${randomUUID()}` },
    });
  }

  /** 更新金额、Keys 数量、排序和上架状态。 */
  async updateRechargePackage(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.rechargePackage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("充值套餐不存在");
    return this.prisma.rechargePackage.update({
      where: { id },
      data: this.rechargePackageInput(body),
    });
  }

  private rechargePackageInput(body: Record<string, unknown>) {
    const name = String(body.name ?? "").trim();
    const keys = Number(body.keys);
    const amountFen = Number(body.amountFen);
    const sortOrder = Number(body.sortOrder ?? 0);
    if (!name || name.length > 30) throw new BadRequestException("套餐名称须为 1-30 个字符");
    if (!Number.isInteger(keys) || keys < 1 || keys > 10_000_000)
      throw new BadRequestException("Keys 数量须为 1-10000000 的整数");
    if (!Number.isInteger(amountFen) || amountFen < 1 || amountFen > 100_000_000)
      throw new BadRequestException("充值金额须为 0.01-1000000 元");
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999)
      throw new BadRequestException("排序须为 0-9999 的整数");
    return { name, keys, amountFen, sortOrder, active: body.active !== false };
  }

  /** 运营人员人工增减 Keys，同时写入不可丢失的账本记录。 */
  async adjustPoints(userId: string, body: { amount?: number; reason?: string }) {
    const amount = Number(body.amount);
    const reason = body.reason?.trim();
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000)
      throw new BadRequestException("调整 Keys 必须是 -100000 到 100000 之间的非零整数");
    if (!reason || reason.length > 100) throw new BadRequestException("请填写 1-100 字调整原因");
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.pointAccount.findUnique({ where: { userId } });
      if (!account) throw new NotFoundException("用户 Keys 账户不存在");
      if (account.balance + amount < 0) throw new BadRequestException("扣减后余额不能小于 0");
      const updated = await tx.pointAccount.update({
        where: { userId },
        data: { balance: { increment: amount } },
      });
      await tx.pointLedger.create({
        data: {
          userId,
          type: LedgerType.ADJUSTMENT,
          amount,
          balanceAfter: updated.balance,
          referenceId: `manage:${randomUUID()}`,
          description: reason,
        },
      });
      return updated;
    });
  }

  /** 修改用户的单一业务角色。 */
  async updateUserRole(userId: string, body: { role?: Role }) {
    if (!Object.values(Role).includes(body.role as Role))
      throw new BadRequestException("请选择有效的用户角色");
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("用户不存在");
    return this.prisma.user.update({
      where: { id: userId },
      data: { roles: [body.role as Role] },
      select: { id: true, roles: true },
    });
  }
}
