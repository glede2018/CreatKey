import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AiInvocationStatus,
  AssetStatus,
  LedgerType,
  PaymentStatus,
  Prisma,
  Role,
  RunStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { MediaService } from "../media/media.service";

const DAY = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

@Injectable()
export class ManageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

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

  /** 分页返回 Akool 模型；上架优先，并支持关键词与内部能力组合筛选。 */
  async models(query = "", capability = "", pageValue = 1) {
    const page = Math.max(1, Number(pageValue) || 1);
    const pageSize = 20;
    const keyword = query.trim();
    const where: Prisma.AiModelWhereInput = {
      ...(capability.trim() ? { capability: capability.trim() } : {}),
      ...(keyword
        ? {
            OR: [
              { providerModelId: { contains: keyword, mode: "insensitive" } },
              { name: { contains: keyword, mode: "insensitive" } },
              { vendor: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.aiModel.findMany({
        where,
        orderBy: [{ active: "desc" }, { capability: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiModel.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async modelInvocations(pageValue = 1, modelId?: string, status?: string) {
    const page = Math.max(1, Number(pageValue) || 1);
    const pageSize = 20;
    const where: Prisma.AiModelInvocationWhereInput = {
      ...(modelId ? { model: { providerModelId: modelId } } : {}),
      ...(Object.values(AiInvocationStatus).includes(status as AiInvocationStatus)
        ? { status: status as AiInvocationStatus }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.aiModelInvocation.findMany({
        where,
        include: {
          model: { select: { providerModelId: true, name: true, vendor: true, capability: true } },
          user: { select: { id: true, nickname: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiModelInvocation.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async assetProducts(query = "", status?: string, pageValue = 1) {
    const page = Math.max(1, Number(pageValue) || 1);
    const pageSize = 15;
    const parsedStatus = Object.values(AssetStatus).includes(status as AssetStatus)
      ? (status as AssetStatus)
      : undefined;
    const where: Prisma.ProductAssetWhereInput = {
      deletedAt: null,
      ...(parsedStatus ? { status: parsedStatus } : {}),
      ...(query.trim()
        ? {
            OR: [
              { title: { contains: query.trim(), mode: "insensitive" } },
              { owner: { nickname: { contains: query.trim(), mode: "insensitive" } } },
              { owner: { phone: { contains: query.trim() } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.productAsset.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, nickname: true, phone: true } },
          category: { select: { id: true, name: true } },
          images: { include: { file: true }, orderBy: { sortOrder: "asc" } },
        },
      }),
      this.prisma.productAsset.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        images: item.images.map((image) => ({
          ...image,
          file: this.media.publicAsset(image.file),
        })),
      })),
      total,
      page,
      pageSize,
    };
  }

  async assetCharacters(query = "", status?: string, pageValue = 1) {
    const page = Math.max(1, Number(pageValue) || 1);
    const pageSize = 15;
    const parsedStatus = Object.values(AssetStatus).includes(status as AssetStatus)
      ? (status as AssetStatus)
      : undefined;
    const where: Prisma.CharacterAssetWhereInput = {
      deletedAt: null,
      ...(parsedStatus ? { status: parsedStatus } : {}),
      ...(query.trim()
        ? {
            OR: [
              { name: { contains: query.trim(), mode: "insensitive" } },
              { owner: { nickname: { contains: query.trim(), mode: "insensitive" } } },
              { owner: { phone: { contains: query.trim() } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.characterAsset.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, nickname: true, phone: true } },
          images: { include: { file: true }, orderBy: { sortOrder: "asc" } },
        },
      }),
      this.prisma.characterAsset.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        images: item.images.map((image) => ({
          ...image,
          file: this.media.publicAsset(image.file),
        })),
      })),
      total,
      page,
      pageSize,
    };
  }

  async updateAssetStatus(type: string, id: string, body: Record<string, unknown>) {
    const status = body.status;
    if (status !== AssetStatus.ACTIVE && status !== AssetStatus.DISABLED)
      throw new BadRequestException("资产状态无效");
    if (type === "products") {
      const existing = await this.prisma.productAsset.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new NotFoundException("商品不存在");
      return this.prisma.productAsset.update({
        where: { id },
        data: { status: status as AssetStatus },
      });
    }
    if (type === "characters") {
      const existing = await this.prisma.characterAsset.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException("形象不存在");
      return this.prisma.characterAsset.update({
        where: { id },
        data: { status: status as AssetStatus },
      });
    }
    throw new BadRequestException("资产类型无效");
  }

  /** 返回完整分类树，运营侧可同时查看停用分类及商品引用数量。 */
  async productCategories() {
    const items = await this.prisma.productCategory.findMany({
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    return items
      .filter((item) => item.level === 1)
      .map((root) => ({
        ...root,
        children: items
          .filter((item) => item.parentId === root.id)
          .map((branch) => ({
            ...branch,
            children: items
              .filter((item) => item.parentId === branch.id)
              .map((leaf) => ({ ...leaf, children: [] })),
          })),
      }));
  }

  /** 新增根分类或子分类，层级由上级自动推导且最多三级。 */
  async createProductCategory(body: Record<string, unknown>) {
    const input = this.productCategoryInput(body);
    const parentId = this.optionalId(body.parentId);
    const parent = parentId
      ? await this.prisma.productCategory.findUnique({ where: { id: parentId } })
      : null;
    if (parentId && !parent) throw new NotFoundException("上级分类不存在");
    if (parent && parent.level >= 3) throw new BadRequestException("商品分类最多支持三级");
    await this.ensureCategoryNameAvailable(input.name, parentId);
    return this.prisma.productCategory.create({
      data: {
        ...input,
        code: `category-${randomUUID()}`,
        level: parent ? parent.level + 1 : 1,
        parentId,
      },
      include: { _count: { select: { products: true } } },
    });
  }

  /** 编辑分类基础信息；不在编辑时移动层级，以避免产生循环目录。 */
  async updateProductCategory(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("商品分类不存在");
    const input = this.productCategoryInput(body);
    await this.ensureCategoryNameAvailable(input.name, existing.parentId, id);
    return this.prisma.productCategory.update({
      where: { id },
      data: input,
      include: { _count: { select: { products: true } } },
    });
  }

  /** 仅允许删除没有子分类且未被任何商品引用的分类。 */
  async deleteProductCategory(id: string) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!existing) throw new NotFoundException("商品分类不存在");
    if (existing._count.children > 0) throw new BadRequestException("请先删除该分类下的子分类");
    if (existing._count.products > 0)
      throw new BadRequestException("该分类已有商品引用，无法删除，可改为停用");
    await this.prisma.productCategory.delete({ where: { id } });
    return { id };
  }

  /** 上下架模型；状态会同时影响创作端目录和实际执行。 */
  async updateModelStatus(modelId: string, body: Record<string, unknown>) {
    if (typeof body.active !== "boolean") throw new BadRequestException("模型状态无效");
    const existing = await this.prisma.aiModel.findUnique({ where: { providerModelId: modelId } });
    if (!existing) throw new NotFoundException("模型不存在");
    return this.prisma.aiModel.update({
      where: { providerModelId: modelId },
      data: { active: body.active },
    });
  }

  /** 更新基础 Keys、参数默认值及枚举/布尔选项的 SET/ADD Keys。 */
  async updateModelCosts(modelId: string, body: Record<string, unknown>) {
    const existing = await this.prisma.aiModel.findUnique({ where: { providerModelId: modelId } });
    if (!existing) throw new NotFoundException("模型不存在");
    const baseKeys = Number(body.baseKeys);
    if (!Number.isInteger(baseKeys) || baseKeys < 0 || baseKeys > 1_000_000)
      throw new BadRequestException("基础 Keys 必须是 0 到 1000000 的整数");
    if (!Array.isArray(body.fields)) throw new BadRequestException("模型参数结构无效");
    const keys = new Set<string>();
    const fields = body.fields.map((raw, fieldIndex) => {
      if (!raw || typeof raw !== "object")
        throw new BadRequestException(`第 ${fieldIndex + 1} 个参数无效`);
      const field = raw as Record<string, unknown>;
      const key = String(field.key ?? "").trim();
      const type = String(field.type ?? "string").toLowerCase();
      if (!key || keys.has(key))
        throw new BadRequestException(`参数字段 ${key || fieldIndex + 1} 无效或重复`);
      keys.add(key);
      const normalizeValue = (value: unknown) => {
        if (type.includes("boolean"))
          return value === true || String(value).toLowerCase() === "true";
        if (type.includes("int") || type.includes("number")) {
          if (value === "" || value === null || value === undefined) return "";
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) throw new BadRequestException(`${key} 的值必须是数字`);
          return parsed;
        }
        return value === null || value === undefined ? "" : String(value);
      };
      const optionValues = new Set<string>();
      const options = (Array.isArray(field.options) ? field.options : []).map(
        (rawOption, optionIndex) => {
          if (!rawOption || typeof rawOption !== "object")
            throw new BadRequestException(`${key} 的第 ${optionIndex + 1} 个选项无效`);
          const option = rawOption as Record<string, unknown>;
          const value = normalizeValue(option.value);
          const serializedValue = JSON.stringify(value);
          if (optionValues.has(serializedValue))
            throw new BadRequestException(`${key} 存在重复的枚举值 ${String(value)}`);
          optionValues.add(serializedValue);
          const keysMode = ["NONE", "SET", "ADD"].includes(String(option.keysMode))
            ? String(option.keysMode)
            : "NONE";
          const keysValue = Number(option.keysValue ?? 0);
          if (!Number.isInteger(keysValue) || keysValue < 0 || keysValue > 1_000_000)
            throw new BadRequestException(`${key} 的选项 Keys 必须是 0 到 1000000 的整数`);
          return {
            label: String(option.label ?? value),
            value,
            keysMode,
            keysValue: keysMode === "NONE" ? 0 : keysValue,
          };
        },
      );
      const normalizedDefault = normalizeValue(field.default);
      if (
        type.includes("enum") &&
        options.length &&
        normalizedDefault !== "" &&
        !options.some((option) => option.value === normalizedDefault)
      )
        throw new BadRequestException(`${key} 的默认值不在枚举选项中`);
      return {
        key,
        type: String(field.type ?? "string"),
        required: Boolean(field.required),
        default: normalizedDefault,
        range: String(field.range ?? ""),
        description: String(field.description ?? ""),
        options,
      };
    });
    return this.prisma.aiModel.update({
      where: { providerModelId: modelId },
      data: { baseKeys, fields: fields as Prisma.InputJsonValue },
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

  private productCategoryInput(body: Record<string, unknown>) {
    const name = String(body.name ?? "").trim();
    const sortOrder = Number(body.sortOrder ?? 0);
    if (!name || name.length > 30) throw new BadRequestException("分类名称须为 1-30 个字符");
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999)
      throw new BadRequestException("排序须为 0-9999 的整数");
    return { name, sortOrder, active: body.active !== false };
  }

  private optionalId(value: unknown) {
    const id = String(value ?? "").trim();
    return id || null;
  }

  private async ensureCategoryNameAvailable(
    name: string,
    parentId: string | null,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.productCategory.findFirst({
      where: { name, parentId, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException("同一上级下已存在同名分类");
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
