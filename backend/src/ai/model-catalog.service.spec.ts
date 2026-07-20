import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ModelCatalogService } from "./model-catalog.service";

describe("ModelCatalogService", () => {
  it("filters disabled models from the public catalog", async () => {
    const prisma = {
      aiModelSetting: {
        findMany: vi.fn().mockResolvedValue([{ modelId: "qwen3.5-plus" }]),
      },
      aiModelCapabilityCost: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new ModelCatalogService(prisma as any);

    const models = await service.availableModels();

    expect(models.some((model) => model.id === "qwen3.5-plus")).toBe(false);
    expect(models.length).toBeGreaterThan(0);
  });

  it("rejects execution when a model is disabled", async () => {
    const prisma = {
      aiModelSetting: {
        findUnique: vi.fn().mockResolvedValue({ modelId: "qwen3.5-plus", active: false }),
      },
    };
    const service = new ModelCatalogService(prisma as any);

    await expect(service.assertAvailable("qwen3.5-plus")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("uses configured capability Keys before catalog defaults", async () => {
    const prisma = {
      aiModelCapabilityCost: {
        findUnique: vi.fn().mockResolvedValue({ keys: 18 }),
      },
    };
    const service = new ModelCatalogService(prisma as any);

    await expect(service.executionKeys("qwen-image-2.0-pro", "ai.text-to-image")).resolves.toBe(18);
  });

  it("uses different defaults for text-to-image and image-to-image", async () => {
    const prisma = {
      aiModelCapabilityCost: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new ModelCatalogService(prisma as any);

    await expect(service.executionKeys("qwen-image-2.0-pro", "ai.text-to-image")).resolves.toBe(10);
    await expect(service.executionKeys("qwen-image-2.0-pro", "ai.image-to-image")).resolves.toBe(
      20,
    );
  });
});
