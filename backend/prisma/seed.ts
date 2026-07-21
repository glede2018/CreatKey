import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
