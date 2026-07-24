import { PrismaClient } from "@prisma/client";
import { akoolModelManifest } from "./akool-model-manifest";

const prisma = new PrismaClient();

type KeysMode = "NONE" | "SET" | "ADD";
type StoredOption = {
  label: string;
  value: string | number | boolean;
  keysMode: KeysMode;
  keysValue: number;
};

const enumVocabulary = new Set(
  [
    "auto",
    "low",
    "medium",
    "high",
    "png",
    "jpeg",
    "jpg",
    "webp",
    "transparent",
    "opaque",
    "customize",
    "intelligence",
    "subject",
    "background",
    "adaptive",
    "origin",
    "single",
    "multi",
    "image",
    "video",
    "base",
    "feature",
    "yes",
    "no",
    ...akoolModelManifest
      .flatMap((model) => model.fields)
      .filter((field) => field.type.toLowerCase().includes("enum"))
      .map((field) => String(field.default ?? "").toLowerCase())
      .filter((value) => /^[a-z_-]+$/.test(value)),
  ].sort((left, right) => right.length - left.length),
);

interface DemoCategory {
  code: string;
  name: string;
  children?: DemoCategory[];
}

const demoProductCategories: DemoCategory[] = [
  {
    code: "clothing",
    name: "服饰鞋包",
    children: [
      {
        code: "clothing-womens",
        name: "女装",
        children: [
          { code: "clothing-womens-dresses", name: "连衣裙" },
          { code: "clothing-womens-tops", name: "上衣" },
          { code: "clothing-womens-pants", name: "裤装" },
        ],
      },
      {
        code: "clothing-mens",
        name: "男装",
        children: [
          { code: "clothing-mens-tshirts", name: "T恤" },
          { code: "clothing-mens-shirts", name: "衬衫" },
          { code: "clothing-mens-jackets", name: "外套" },
        ],
      },
      {
        code: "clothing-bags",
        name: "鞋包配饰",
        children: [
          { code: "clothing-bags-shoes", name: "鞋靴" },
          { code: "clothing-bags-handbags", name: "箱包" },
          { code: "clothing-bags-accessories", name: "配饰" },
        ],
      },
    ],
  },
  {
    code: "beauty",
    name: "美妆个护",
    children: [
      {
        code: "beauty-skincare",
        name: "护肤",
        children: [
          { code: "beauty-skincare-cleanser", name: "洁面" },
          { code: "beauty-skincare-serum", name: "精华" },
          { code: "beauty-skincare-cream", name: "面霜" },
        ],
      },
      {
        code: "beauty-makeup",
        name: "彩妆",
        children: [
          { code: "beauty-makeup-base", name: "底妆" },
          { code: "beauty-makeup-lip", name: "唇妆" },
          { code: "beauty-makeup-eye", name: "眼妆" },
        ],
      },
      {
        code: "beauty-personal-care",
        name: "个人护理",
        children: [
          { code: "beauty-care-hair", name: "洗护发" },
          { code: "beauty-care-body", name: "身体护理" },
          { code: "beauty-care-oral", name: "口腔护理" },
        ],
      },
    ],
  },
  {
    code: "food",
    name: "食品饮料",
    children: [
      {
        code: "food-snacks",
        name: "休闲零食",
        children: [
          { code: "food-snacks-nuts", name: "坚果炒货" },
          { code: "food-snacks-candy", name: "糖果巧克力" },
          { code: "food-snacks-bakery", name: "饼干糕点" },
        ],
      },
      {
        code: "food-beverages",
        name: "饮料冲调",
        children: [
          { code: "food-beverages-tea", name: "茶饮" },
          { code: "food-beverages-coffee", name: "咖啡" },
          { code: "food-beverages-juice", name: "果汁饮料" },
        ],
      },
      {
        code: "food-fresh",
        name: "生鲜食品",
        children: [
          { code: "food-fresh-fruit", name: "水果" },
          { code: "food-fresh-meat", name: "肉禽蛋" },
          { code: "food-fresh-seafood", name: "水产海鲜" },
        ],
      },
    ],
  },
  {
    code: "home",
    name: "家居生活",
    children: [
      {
        code: "home-kitchen",
        name: "厨房用品",
        children: [
          { code: "home-kitchen-cookware", name: "锅具" },
          { code: "home-kitchen-tableware", name: "餐具" },
          { code: "home-kitchen-storage", name: "厨房收纳" },
        ],
      },
      {
        code: "home-textiles",
        name: "家纺布艺",
        children: [
          { code: "home-textiles-bedding", name: "床上用品" },
          { code: "home-textiles-towels", name: "毛巾浴巾" },
          { code: "home-textiles-curtains", name: "窗帘布艺" },
        ],
      },
      {
        code: "home-cleaning",
        name: "清洁用品",
        children: [
          { code: "home-cleaning-laundry", name: "衣物清洁" },
          { code: "home-cleaning-household", name: "居家清洁" },
          { code: "home-cleaning-tools", name: "清洁工具" },
        ],
      },
    ],
  },
  {
    code: "digital",
    name: "数码家电",
    children: [
      {
        code: "digital-mobile",
        name: "手机数码",
        children: [
          { code: "digital-mobile-phones", name: "手机" },
          { code: "digital-mobile-headphones", name: "耳机" },
          { code: "digital-mobile-accessories", name: "手机配件" },
        ],
      },
      {
        code: "digital-computers",
        name: "电脑办公",
        children: [
          { code: "digital-computers-laptops", name: "笔记本电脑" },
          { code: "digital-computers-monitors", name: "显示器" },
          { code: "digital-computers-peripherals", name: "电脑外设" },
        ],
      },
      {
        code: "digital-appliances",
        name: "生活家电",
        children: [
          { code: "digital-appliances-kitchen", name: "厨房小家电" },
          { code: "digital-appliances-cleaning", name: "清洁电器" },
          { code: "digital-appliances-personal", name: "个护电器" },
        ],
      },
    ],
  },
];

async function seedCategory(
  category: DemoCategory,
  level: number,
  sortOrder: number,
  parentId?: string,
) {
  const saved = await prisma.productCategory.upsert({
    where: { code: category.code },
    create: {
      code: category.code,
      name: category.name,
      level,
      parentId,
      sortOrder,
      active: true,
    },
    update: {
      name: category.name,
      level,
      parentId,
      sortOrder,
      active: true,
    },
  });

  for (const [index, child] of (category.children ?? []).entries()) {
    await seedCategory(child, level + 1, (index + 1) * 10, saved.id);
  }
}

async function main() {
  for (const [index, category] of demoProductCategories.entries()) {
    await seedCategory(category, 1, (index + 1) * 10);
  }
  const count = await prisma.productCategory.count();
  console.log(`Product categories seeded: ${count}`);

  for (const [index, item] of akoolModelManifest.entries()) {
    const capability = normalizeAkoolCapability(item.providerModelId, item.capability);
    const existing = await prisma.aiModel.findUnique({
      where: { providerModelId: item.providerModelId },
      select: { fields: true },
    });
    const fields = mergeModelFields(existing?.fields, item.fields);
    await prisma.aiModel.upsert({
      where: { providerModelId: item.providerModelId },
      create: {
        providerModelId: item.providerModelId,
        name: item.name,
        vendor: item.vendor,
        capability,
        fields: fields as never,
        baseKeys: 0,
        pricingRules: [],
        active: false,
        sortOrder: index * 10,
      },
      update: {
        name: item.name,
        vendor: item.vendor,
        capability,
        fields: fields as never,
        sortOrder: index * 10,
      },
    });
  }
  console.log(`Akool models synced: ${akoolModelManifest.length}`);
}

function mergeModelFields(
  existingValue: unknown,
  manifestFields: (typeof akoolModelManifest)[number]["fields"],
) {
  const existingFields = Array.isArray(existingValue) ? existingValue : [];
  const existingByKey = new Map(
    existingFields
      .filter(
        (field): field is Record<string, unknown> => Boolean(field) && typeof field === "object",
      )
      .map((field) => [String(field.key), field]),
  );
  return manifestFields.map((field) => {
    const current = existingByKey.get(field.key);
    if (current && Object.prototype.hasOwnProperty.call(current, "options")) return current;
    return {
      ...field,
      default: normalizeFieldValue(field.default, field.type),
      options: inferFieldOptions(field),
    };
  });
}

function inferFieldOptions(field: (typeof akoolModelManifest)[number]["fields"][number]) {
  const type = field.type.toLowerCase();
  if (type.includes("boolean")) return [false, true].map(optionView);
  if (!type.includes("enum")) return [];
  const range = String(field.range ?? "").trim();
  const values: Array<string | number> = [];
  const add = (value: string | number) => {
    if (value !== "" && !values.some((current) => current === value)) values.push(value);
  };

  for (const value of range.match(/\d+(?:\.\d+)?:\d+(?:\.\d+)?/g) ?? []) add(value);
  for (const value of range.match(/\d+\*\d+/g) ?? []) add(value);
  for (const value of range.match(/\d+(?:\.\d+)?[pPkK]/g) ?? []) add(value);
  if (/^512/.test(range)) add("512");

  if (type.includes("int") || type.includes("number")) {
    numericEnumValues(range, Number(field.default)).forEach(add);
  } else {
    const residue = range
      .replace(/\d+(?:\.\d+)?:\d+(?:\.\d+)?/g, "")
      .replace(/\d+\*\d+/g, "")
      .replace(/\d+(?:\.\d+)?[pPkK]/g, "")
      .toLowerCase();
    segmentWords(residue).forEach(add);
  }

  const normalizedDefault = normalizeFieldValue(field.default, field.type);
  if (normalizedDefault !== "" && normalizedDefault !== null && normalizedDefault !== undefined)
    add(normalizedDefault as string | number);
  return values.map(optionView);
}

function optionView(value: string | number | boolean): StoredOption {
  return { label: String(value), value, keysMode: "NONE", keysValue: 0 };
}

function normalizeFieldValue(value: unknown, type: string) {
  if (value === null || value === undefined || value === "-") return "";
  const normalizedType = type.toLowerCase();
  if (normalizedType.includes("boolean"))
    return value === true || String(value).toLowerCase() === "true";
  if (normalizedType.includes("int") || normalizedType.includes("number")) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : "";
  }
  return String(value);
}

function numericEnumValues(raw: string, defaultValue: number) {
  const source = raw.replace(/[^\d]/g, "");
  if (!source) return [];
  const candidates: number[][] = [];
  const visit = (offset: number, values: number[]) => {
    if (offset === source.length) {
      if (!Number.isFinite(defaultValue) || values.includes(defaultValue)) candidates.push(values);
      return;
    }
    for (let size = 1; size <= 2 && offset + size <= source.length; size += 1) {
      const token = source.slice(offset, offset + size);
      if (token.length > 1 && token.startsWith("0")) continue;
      const value = Number(token);
      if (value > 60 || (values.length && value <= values[values.length - 1])) continue;
      visit(offset + size, [...values, value]);
    }
  };
  visit(0, []);
  return (candidates.sort((left, right) => right.length - left.length)[0] ?? []).map(Number);
}

function segmentWords(raw: string) {
  const source = raw.replace(/[^a-z_-]/g, "");
  if (!source) return [];
  const memo = new Map<number, string[] | null>();
  const visit = (offset: number): string[] | null => {
    if (offset === source.length) return [];
    if (memo.has(offset)) return memo.get(offset)!;
    for (const word of enumVocabulary) {
      if (!source.startsWith(word, offset)) continue;
      const rest = visit(offset + word.length);
      if (rest) {
        const result = [word, ...rest];
        memo.set(offset, result);
        return result;
      }
    }
    memo.set(offset, null);
    return null;
  };
  return visit(0) ?? [];
}

function normalizeAkoolCapability(modelId: string, fallback: string) {
  const value = modelId.toLowerCase();
  if (value.includes("text-to-vector")) return "ai.text-to-vector";
  if (value.includes("image-to-vector")) return "ai.image-to-vector";
  if (value.includes("video-extend")) return "ai.video-extend";
  if (value.includes("video-resize")) return "ai.video-resize";
  return fallback;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
