import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ModelCatalogService } from "./model-catalog.service";

const model = {
  id: "db-id",
  providerModelId: "vendor/model",
  name: "Model",
  vendor: "vendor",
  capability: "ai.text-to-image",
  baseKeys: 10,
  fields: [],
  pricingRules: [{ field: "resolution", operator: "EQ", value: "1080p", keys: 25 }],
  active: true,
  sortOrder: 0,
  description: null,
  outputSchema: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ModelCatalogService", () => {
  it("only exposes active database models", async () => {
    const prisma = { aiModel: { findMany: vi.fn().mockResolvedValue([model]) } };
    const models = await new ModelCatalogService(prisma as any).availableModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("vendor/model");
  });

  it("rejects disabled models", async () => {
    const prisma = {
      aiModel: { findUnique: vi.fn().mockResolvedValue({ ...model, active: false }) },
    };
    await expect(
      new ModelCatalogService(prisma as any).requireAvailable("vendor/model"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("uses the first matching parameter pricing rule", async () => {
    const prisma = { aiModel: { findUnique: vi.fn().mockResolvedValue(model) } };
    const service = new ModelCatalogService(prisma as any);
    await expect(
      service.executionKeys("vendor/model", "ai.text-to-image", { resolution: "1080p" }),
    ).resolves.toBe(25);
    await expect(
      service.executionKeys("vendor/model", "ai.text-to-image", { resolution: "720p" }),
    ).resolves.toBe(10);
  });

  it("applies enum SET and ADD pricing, including parameter defaults", async () => {
    const optionModel = {
      ...model,
      pricingRules: [],
      baseKeys: 10,
      fields: [
        {
          key: "resolution",
          type: "string (enum)",
          default: "720p",
          options: [
            { label: "720p", value: "720p", keysMode: "SET", keysValue: 20 },
            { label: "1080p", value: "1080p", keysMode: "SET", keysValue: 30 },
          ],
        },
        {
          key: "duration",
          type: "int (enum)",
          default: 5,
          options: [
            { label: "5", value: 5, keysMode: "NONE", keysValue: 0 },
            { label: "8", value: 8, keysMode: "ADD", keysValue: 10 },
          ],
        },
      ],
    };
    const prisma = { aiModel: { findUnique: vi.fn().mockResolvedValue(optionModel) } };
    const service = new ModelCatalogService(prisma as any);

    const defaults = await service.executionPricing("vendor/model", "ai.text-to-image", {});
    expect(defaults.keys).toBe(20);
    expect(defaults.snapshot.optionAdjustments).toHaveLength(1);
    await expect(
      service.executionKeys("vendor/model", "ai.text-to-image", {
        resolution: "1080p",
        duration: 8,
      }),
    ).resolves.toBe(40);
  });
});
