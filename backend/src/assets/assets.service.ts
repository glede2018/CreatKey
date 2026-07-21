import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AssetSource,
  AssetStatus,
  CharacterImageAngle,
  Prisma,
  ProductImageRole,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AiGatewayService } from "../ai/ai-gateway.service";
import { ModelCatalogService } from "../ai/model-catalog.service";
import { PointsService } from "../billing/points.service";
import { PrismaService } from "../database/prisma.service";
import { MediaService } from "../media/media.service";

const PAGE_SIZE = 20;
const productInclude = {
  category: true,
  images: { include: { file: true }, orderBy: { sortOrder: "asc" as const } },
};
const characterInclude = {
  referenceFile: true,
  images: { include: { file: true }, orderBy: { sortOrder: "asc" as const } },
};
const CHARACTER_CAPABILITY = "ai.image-to-image";
const DEFAULT_CHARACTER_MODEL = "qwen-image-2.0-pro";

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly ai: AiGatewayService,
    private readonly models: ModelCatalogService,
    private readonly points: PointsService,
  ) {}

  async categories() {
    const items = await this.prisma.productCategory.findMany({
      where: { active: true },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return items
      .filter((item) => item.level === 1)
      .map((item) => ({
        ...item,
        children: items
          .filter((child) => child.parentId === item.id)
          .map((child) => ({
            ...child,
            children: items.filter((leaf) => leaf.parentId === child.id),
          })),
      }));
  }

  async products(
    ownerId: string,
    filters: { query?: string; categoryId?: string; status?: string; page?: number },
  ) {
    const page = Math.max(1, Number(filters.page) || 1);
    const status = this.readStatus(filters.status);
    const where: Prisma.ProductAssetWhereInput = {
      ownerId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.query?.trim()
        ? { title: { contains: filters.query.trim(), mode: "insensitive" } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.productAsset.findMany({
        where,
        include: productInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.productAsset.count({ where }),
    ]);
    return { items: items.map((item) => this.productView(item)), total, page, pageSize: PAGE_SIZE };
  }

  async createProduct(ownerId: string, body: Record<string, unknown>) {
    const data = await this.productInput(ownerId, body);
    const product = await this.prisma.productAsset.create({
      data: {
        ownerId,
        ...data.fields,
        images: {
          create: data.fileIds.map((fileId, index) => ({
            fileId,
            role: index === 0 ? ProductImageRole.COVER : ProductImageRole.DETAIL,
            sortOrder: index * 10,
          })),
        },
      },
      include: productInclude,
    });
    return this.productView(product);
  }

  async updateProduct(id: string, ownerId: string, body: Record<string, unknown>) {
    await this.ownedProduct(id, ownerId);
    const data = await this.productInput(ownerId, body);
    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      const product = await tx.productAsset.update({
        where: { id },
        data: {
          ...data.fields,
          images: {
            create: data.fileIds.map((fileId, index) => ({
              fileId,
              role: index === 0 ? ProductImageRole.COVER : ProductImageRole.DETAIL,
              sortOrder: index * 10,
            })),
          },
        },
        include: productInclude,
      });
      return this.productView(product);
    });
  }

  async deleteProduct(id: string, ownerId: string) {
    await this.ownedProduct(id, ownerId);
    await this.prisma.productAsset.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  async characters(ownerId: string, filters: { query?: string; status?: string; page?: number }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const status = this.readStatus(filters.status);
    const where: Prisma.CharacterAssetWhereInput = {
      ownerId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(filters.query?.trim()
        ? { name: { contains: filters.query.trim(), mode: "insensitive" } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.characterAsset.findMany({
        where,
        include: characterInclude,
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.characterAsset.count({ where }),
    ]);
    return {
      items: items.map((item) => this.characterView(item)),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async characterGenerationConfig() {
    const available = await this.models.availableModels();
    const model = available.find(
      (item) =>
        item.id === DEFAULT_CHARACTER_MODEL && item.capabilities.includes(CHARACTER_CAPABILITY),
    );
    if (!model) throw new BadRequestException("形象生成模型当前不可用");
    return {
      modelId: model.id,
      modelName: model.name.replace(/ 编辑$/, ""),
      keys: await this.models.executionKeys(model.id, CHARACTER_CAPABILITY),
    };
  }

  async generateCharacter(ownerId: string, body: Record<string, unknown>) {
    const referenceFileId = this.requiredText(body.referenceFileId, "参考图", 100);
    const prompt = this.requiredText(body.prompt, "形象描述", 1000);
    const modelId = String(body.modelId ?? DEFAULT_CHARACTER_MODEL);
    const referenceFile = await this.prisma.assetFile.findFirst({
      where: { id: referenceFileId, ownerId, mediaType: "image", deletedAt: null },
    });
    if (!referenceFile) throw new BadRequestException("参考图不存在或无权使用");
    const cost = await this.models.executionKeys(modelId, CHARACTER_CAPABILITY);
    const referenceId = `character-generation:${randomUUID()}`;
    await this.points.consumeDirect(ownerId, referenceId, cost, "AI 形象生成");
    try {
      const reference = this.media.publicAsset(referenceFile);
      const result = (await this.ai.execute(
        CHARACTER_CAPABILITY,
        modelId,
        { prompt, ratio: "1:1", count: 1, promptExtend: true },
        [{ targetHandle: "image", value: { type: "image", assets: [reference] } }],
      )) as {
        assets?: Array<{
          id: string;
          url: string;
          name: string;
          type: string;
          mimeType: string;
          size: number;
        }>;
      };
      const generated = result.assets?.[0];
      if (!generated) throw new Error("形象生成模型未返回图片");
      await this.prisma.assetFile.update({ where: { id: generated.id }, data: { ownerId } });
      return { referenceId, modelId, prompt, cost, generated };
    } catch (error) {
      await this.points.refundDirect(ownerId, referenceId, cost, "AI 形象生成失败退款");
      throw error;
    }
  }

  async createCharacter(ownerId: string, body: Record<string, unknown>) {
    const data = await this.characterInput(ownerId, body);
    const count = await this.prisma.characterAsset.count({ where: { ownerId, deletedAt: null } });
    const character = await this.prisma.$transaction(async (tx) => {
      if (data.isDefault || count === 0)
        await tx.characterAsset.updateMany({ where: { ownerId }, data: { isDefault: false } });
      return tx.characterAsset.create({
        data: {
          ownerId,
          ...data.fields,
          isDefault: data.isDefault || count === 0,
          images: {
            create: data.images.map((image, index) => ({ ...image, sortOrder: index * 10 })),
          },
        },
        include: characterInclude,
      });
    });
    return this.characterView(character);
  }

  async updateCharacter(id: string, ownerId: string, body: Record<string, unknown>) {
    await this.ownedCharacter(id, ownerId);
    const data = await this.characterInput(ownerId, body);
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault)
        await tx.characterAsset.updateMany({ where: { ownerId }, data: { isDefault: false } });
      await tx.characterImage.deleteMany({ where: { characterId: id } });
      const character = await tx.characterAsset.update({
        where: { id },
        data: {
          ...data.fields,
          isDefault: data.isDefault,
          images: {
            create: data.images.map((image, index) => ({ ...image, sortOrder: index * 10 })),
          },
        },
        include: characterInclude,
      });
      return this.characterView(character);
    });
  }

  async setDefaultCharacter(id: string, ownerId: string) {
    await this.ownedCharacter(id, ownerId);
    return this.prisma.$transaction(async (tx) => {
      await tx.characterAsset.updateMany({ where: { ownerId }, data: { isDefault: false } });
      const character = await tx.characterAsset.update({
        where: { id },
        data: { isDefault: true },
        include: characterInclude,
      });
      return this.characterView(character);
    });
  }

  async deleteCharacter(id: string, ownerId: string) {
    const existing = await this.ownedCharacter(id, ownerId);
    await this.prisma.$transaction(async (tx) => {
      await tx.characterAsset.update({
        where: { id },
        data: { deletedAt: new Date(), isDefault: false },
      });
      if (existing.isDefault) {
        const replacement = await tx.characterAsset.findFirst({
          where: { ownerId, deletedAt: null, id: { not: id } },
          orderBy: { updatedAt: "desc" },
        });
        if (replacement)
          await tx.characterAsset.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
      }
    });
    return { id };
  }

  private async productInput(ownerId: string, body: Record<string, unknown>) {
    const title = this.requiredText(body.title, "商品标题", 80);
    const categoryId = this.requiredText(body.categoryId, "商品分类", 100);
    const sellingPoints = this.stringList(body.sellingPoints, "商品卖点", 8, 200, true);
    const tags = this.stringList(body.tags, "商品标签", 10, 30);
    const fileIds = this.idList(body.imageIds, "商品图片", 20, true);
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, active: true, level: 3 },
    });
    if (!category) throw new BadRequestException("请选择有效的三级商品分类");
    await this.assertOwnedImages(ownerId, fileIds);
    return {
      fields: {
        title,
        categoryId,
        sellingPoints,
        audienceProfile: this.optionalText(body.audienceProfile, 500),
        description: this.optionalText(body.description, 2000),
        sourceUrl: this.optionalUrl(body.sourceUrl),
        tags,
        status: body.status === AssetStatus.DRAFT ? AssetStatus.DRAFT : AssetStatus.ACTIVE,
      },
      fileIds,
    };
  }

  private async characterInput(ownerId: string, body: Record<string, unknown>) {
    const name = this.requiredText(body.name, "形象名称", 30);
    const referenceFileId = this.requiredText(body.referenceFileId, "参考图", 100);
    const generationPrompt = this.requiredText(body.generationPrompt, "形象描述", 1000);
    const modelId = this.requiredText(body.modelId, "生成模型", 100);
    const rawImages = Array.isArray(body.images) ? body.images : [];
    if (rawImages.length !== 1) throw new BadRequestException("形象只能保存 1 张 AI 生成图片");
    const images = rawImages.map((value, index) => {
      if (!value || typeof value !== "object") throw new BadRequestException("形象图片无效");
      const record = value as Record<string, unknown>;
      const fileId = this.requiredText(record.fileId, "形象图片", 100);
      const requested = String(record.angle ?? "OTHER") as CharacterImageAngle;
      const angle = Object.values(CharacterImageAngle).includes(requested)
        ? requested
        : index === 0
          ? CharacterImageAngle.AVATAR
          : CharacterImageAngle.OTHER;
      return { fileId, angle: index === 0 ? CharacterImageAngle.AVATAR : angle };
    });
    await this.assertOwnedImages(ownerId, [
      referenceFileId,
      ...images.map((image) => image.fileId),
    ]);
    return {
      fields: {
        name,
        referenceFileId,
        description: this.optionalText(body.description, 500),
        generationPrompt,
        modelId,
        voiceId: this.optionalText(body.voiceId, 100),
        voiceName: this.optionalText(body.voiceName, 100),
        tags: this.stringList(body.tags, "形象标签", 10, 30),
        source: AssetSource.AI_GENERATED,
        status: body.status === AssetStatus.DRAFT ? AssetStatus.DRAFT : AssetStatus.ACTIVE,
      },
      isDefault: body.isDefault === true,
      images,
    };
  }

  private async assertOwnedImages(ownerId: string, fileIds: string[]) {
    const unique = [...new Set(fileIds)];
    if (unique.length !== fileIds.length) throw new BadRequestException("图片不能重复选择");
    const count = await this.prisma.assetFile.count({
      where: { id: { in: unique }, ownerId, mediaType: "image", deletedAt: null },
    });
    if (count !== unique.length) throw new BadRequestException("存在无效或无权限使用的图片");
  }

  private ownedProduct(id: string, ownerId: string) {
    return this.prisma.productAsset
      .findFirst({ where: { id, ownerId, deletedAt: null } })
      .then((item) => {
        if (!item) throw new NotFoundException("商品不存在");
        return item;
      });
  }

  private ownedCharacter(id: string, ownerId: string) {
    return this.prisma.characterAsset
      .findFirst({ where: { id, ownerId, deletedAt: null } })
      .then((item) => {
        if (!item) throw new NotFoundException("形象不存在");
        return item;
      });
  }

  private productView(product: any) {
    return {
      ...product,
      images: product.images.map((image: any) => ({
        id: image.id,
        role: image.role,
        sortOrder: image.sortOrder,
        file: this.media.publicAsset(image.file),
      })),
    };
  }

  private characterView(character: any) {
    return {
      ...character,
      referenceFile: character.referenceFile
        ? this.media.publicAsset(character.referenceFile)
        : null,
      images: character.images.map((image: any) => ({
        id: image.id,
        angle: image.angle,
        sortOrder: image.sortOrder,
        file: this.media.publicAsset(image.file),
      })),
    };
  }

  private readStatus(value?: string) {
    return Object.values(AssetStatus).includes(value as AssetStatus)
      ? (value as AssetStatus)
      : undefined;
  }

  private requiredText(value: unknown, label: string, max: number) {
    const text = String(value ?? "").trim();
    if (!text || text.length > max) throw new BadRequestException(`${label}须为 1-${max} 个字符`);
    return text;
  }

  private optionalText(value: unknown, max: number) {
    const text = String(value ?? "").trim();
    if (text.length > max) throw new BadRequestException(`内容不能超过 ${max} 个字符`);
    return text || null;
  }

  private optionalUrl(value: unknown) {
    const text = String(value ?? "").trim();
    if (!text) return null;
    try {
      const url = new URL(text);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      return url.toString();
    } catch {
      throw new BadRequestException("来源链接格式无效");
    }
  }

  private stringList(
    value: unknown,
    label: string,
    maxItems: number,
    maxLength: number,
    required = false,
  ) {
    const items = Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : String(value ?? "")
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean);
    if (
      (required && !items.length) ||
      items.length > maxItems ||
      items.some((item) => item.length > maxLength)
    )
      throw new BadRequestException(`${label}数量或长度超出限制`);
    return [...new Set(items)];
  }

  private idList(value: unknown, label: string, maxItems: number, required = false) {
    const items = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
    if ((required && !items.length) || items.length > maxItems)
      throw new BadRequestException(`${label}数量超出限制`);
    return items;
  }
}
