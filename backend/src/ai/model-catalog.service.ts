import { BadRequestException, Injectable } from "@nestjs/common";
import type { AiModel } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

export type PricingOperator = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN";
export interface ModelPricingRule {
  field: string;
  operator: PricingOperator;
  value: unknown;
  keys: number;
}

export interface ModelPricingResult {
  keys: number;
  snapshot: {
    baseKeys: number;
    optionAdjustments: ModelOptionAdjustment[];
    matchedRule: ModelPricingRule | null;
    pricingRules: ModelPricingRule[];
  };
}

export interface ModelOptionAdjustment {
  field: string;
  value: unknown;
  mode: "SET" | "ADD";
  keys: number;
  beforeKeys: number;
  afterKeys: number;
}

@Injectable()
export class ModelCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async availableModels() {
    const models = await this.prisma.aiModel.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return models.map((model) => this.publicModel(model));
  }

  async executionPricing(
    providerModelId: string,
    capability: string,
    config: Record<string, unknown> = {},
  ): Promise<ModelPricingResult> {
    const model = await this.requireAvailable(providerModelId, capability);
    const rules = this.readRules(model.pricingRules);
    const matchedRule = rules.find((rule) => this.matches(rule, config)) ?? null;
    let keys = model.baseKeys;
    const optionAdjustments: ModelOptionAdjustment[] = [];
    for (const adjustment of this.optionPricing(model.fields, config)) {
      const beforeKeys = keys;
      keys = adjustment.mode === "SET" ? adjustment.keys : keys + adjustment.keys;
      optionAdjustments.push({ ...adjustment, beforeKeys, afterKeys: keys });
    }
    if (matchedRule) keys = matchedRule.keys;
    return {
      keys,
      snapshot: {
        baseKeys: model.baseKeys,
        optionAdjustments,
        matchedRule,
        pricingRules: rules,
      },
    };
  }

  async executionKeys(
    providerModelId: string,
    capability: string,
    config: Record<string, unknown> = {},
  ) {
    return (await this.executionPricing(providerModelId, capability, config)).keys;
  }

  async requireAvailable(providerModelId: string, capability?: string) {
    const model = await this.prisma.aiModel.findUnique({ where: { providerModelId } });
    if (!model) throw new BadRequestException(`模型 ${providerModelId} 不存在`);
    if (!model.active) throw new BadRequestException(`模型 ${providerModelId} 已下架`);
    if (capability && model.capability !== capability)
      throw new BadRequestException(`模型 ${providerModelId} 不支持 ${capability}`);
    return model;
  }

  private publicModel(model: AiModel) {
    return {
      id: model.providerModelId,
      name: model.name,
      provider: "akool",
      vendor: model.vendor,
      capabilities: [model.capability],
      capabilityKeys: { [model.capability]: model.baseKeys },
      fields: Array.isArray(model.fields)
        ? model.fields.map((raw) => {
            const field = raw as Record<string, unknown>;
            const sourceType = String(field.type ?? "string").toLowerCase();
            const type = sourceType.includes("enum")
              ? "select"
              : sourceType.includes("number") ||
                  sourceType.includes("integer") ||
                  sourceType.includes("int")
                ? "number"
                : sourceType.includes("boolean")
                  ? "boolean"
                  : ["prompt", "negative_prompt", "text"].includes(String(field.key))
                    ? "textarea"
                    : "text";
            return {
              key: String(field.key ?? ""),
              label: String(field.key ?? ""),
              type,
              default: this.fieldDefault(field.default, sourceType),
              required: Boolean(field.required),
              description: String(field.description ?? ""),
              range: String(field.range ?? ""),
              options: this.readOptions(field.options).map((option) => ({
                label: option.label,
                value: option.value,
                keysMode: option.keysMode,
                keysValue: option.keysValue,
              })),
            };
          })
        : [],
      pricingRules: model.pricingRules,
    };
  }

  private readRules(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ModelPricingRule => {
      if (!item || typeof item !== "object") return false;
      const rule = item as Partial<ModelPricingRule>;
      return (
        typeof rule.field === "string" &&
        ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN"].includes(String(rule.operator)) &&
        Number.isInteger(rule.keys) &&
        Number(rule.keys) >= 0
      );
    });
  }

  private matches(rule: ModelPricingRule, config: Record<string, unknown>) {
    const actual = this.fieldValue(config, rule.field);
    if (rule.operator === "EQ") return actual === rule.value;
    if (rule.operator === "NEQ") return actual !== rule.value;
    if (rule.operator === "IN") return Array.isArray(rule.value) && rule.value.includes(actual);
    const left = Number(actual);
    const right = Number(rule.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (rule.operator === "GT") return left > right;
    if (rule.operator === "GTE") return left >= right;
    if (rule.operator === "LT") return left < right;
    return left <= right;
  }

  private fieldDefault(value: unknown, type: string) {
    if (value === null || value === undefined || value === "-")
      return type.includes("boolean") ? false : "";
    if (type.includes("number") || type.includes("integer") || type.includes("int")) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (type === "boolean") return value === true || String(value).toLowerCase() === "true";
    return String(value);
  }

  private optionPricing(
    fieldsValue: unknown,
    config: Record<string, unknown>,
  ): Array<Omit<ModelOptionAdjustment, "beforeKeys" | "afterKeys">> {
    if (!Array.isArray(fieldsValue)) return [];
    return fieldsValue.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const field = raw as Record<string, unknown>;
      const fieldName = String(field.key ?? "");
      const configured = this.fieldValue(config, fieldName);
      const actual = configured === undefined ? field.default : configured;
      const selected = this.readOptions(field.options).find((option) => option.value === actual);
      if (!selected || selected.keysMode === "NONE" || selected.keysValue === 0) return [];
      return [
        { field: fieldName, value: actual, mode: selected.keysMode, keys: selected.keysValue },
      ];
    });
  }

  private readOptions(value: unknown): Array<{
    label: string;
    value: unknown;
    keysMode: "NONE" | "SET" | "ADD";
    keysValue: number;
  }> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const option = raw as Record<string, unknown>;
      const keysMode = ["SET", "ADD"].includes(String(option.keysMode))
        ? (String(option.keysMode) as "SET" | "ADD")
        : "NONE";
      const keysValue = Number(option.keysValue ?? 0);
      return [
        {
          label: String(option.label ?? option.value ?? ""),
          value: option.value,
          keysMode,
          keysValue: Number.isInteger(keysValue) && keysValue >= 0 ? keysValue : 0,
        },
      ];
    });
  }

  private fieldValue(config: Record<string, unknown>, field: string) {
    return (
      config[field] ??
      field.split(".").reduce<unknown>((value, key) => {
        if (!value || typeof value !== "object") return undefined;
        return (value as Record<string, unknown>)[key];
      }, config)
    );
  }
}
