import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  ImagePlus,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCategoryCascader } from "@/components/product-category-cascader";
import { api, uploadMedia } from "@/lib/api";
import type {
  AssetStatus,
  CharacterAsset,
  MediaAsset,
  PageData,
  ProductAsset,
  ProductCategory,
} from "@/types";

type AssetTab = "products" | "characters";
type ViewMode = "grid" | "list";

const statusLabel: Record<AssetStatus, string> = {
  ACTIVE: "使用中",
  DRAFT: "草稿",
  DISABLED: "已禁用",
};

const emptyPage = <T,>(): PageData<T> => ({ items: [], total: 0, page: 1, pageSize: 20 });

export function AssetsPage() {
  const [tab, setTab] = useState<AssetTab>("products");
  const [view, setView] = useState<ViewMode>("grid");
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<PageData<ProductAsset>>(emptyPage);
  const [characters, setCharacters] = useState<PageData<CharacterAsset>>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductAsset | null>();
  const [editingCharacter, setEditingCharacter] = useState<CharacterAsset | null>();

  useEffect(() => {
    api<ProductCategory[]>("/assets/categories")
      .then(setCategories)
      .catch(() => toast.error("商品分类加载失败"));
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));
    if (tab === "products" && categoryId) params.set("categoryId", categoryId);
    setLoading(true);
    api<PageData<ProductAsset> | PageData<CharacterAsset>>(
      `/assets/${tab}${params.size ? `?${params}` : ""}`,
    )
      .then((data) => {
        if (!active) return;
        if (tab === "products") setProducts(data as PageData<ProductAsset>);
        else setCharacters(data as PageData<CharacterAsset>);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "资产加载失败"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [categoryId, page, query, revision, status, tab]);

  const activePage = tab === "products" ? products : characters;
  const pageCount = Math.max(1, Math.ceil(activePage.total / activePage.pageSize));

  function switchTab(next: AssetTab) {
    setTab(next);
    setPage(1);
    setSearch("");
    setQuery("");
    setStatus("");
    setCategoryId("");
  }

  async function remove(type: AssetTab, id: string, name: string) {
    if (!window.confirm(`确定删除“${name}”吗？`)) return;
    try {
      await api(`/assets/${type}/${id}`, { method: "DELETE" });
      toast.success("资产已删除");
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function setDefault(character: CharacterAsset) {
    try {
      await api(`/assets/characters/${character.id}/default`, { method: "POST" });
      toast.success("默认形象已更新");
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "设置失败");
    }
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto px-3 pb-8 pt-2" aria-label="资产库页面">
      <section className="ck-assets-shell min-h-full rounded-xl p-5 sm:p-6">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">资产库</h1>
            <p className="mt-1.5 text-xs text-zinc-500">管理用于 AI 创作的商品与角色资产</p>
          </div>
          <Button
            onClick={() =>
              tab === "products" ? setEditingProduct(null) : setEditingCharacter(null)
            }
          >
            <Plus size={16} /> {tab === "products" ? "添加商品" : "创建形象"}
          </Button>
        </header>

        <div className="mt-6 flex border-b border-white/[.08]">
          {(["products", "characters"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchTab(item)}
              className={`relative h-11 px-5 text-sm transition ${tab === item ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {item === "products" ? "商品库" : "形象库"}
              {tab === item && <i className="absolute inset-x-4 bottom-0 h-0.5 bg-blue-500" />}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <form
              className="relative w-full sm:max-w-xs"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setQuery(search.trim());
              }}
            >
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                size={15}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={tab === "products" ? "搜索商品" : "搜索形象"}
                className="h-9 pl-9 text-xs"
              />
            </form>
            {tab === "products" && (
              <select
                value={categoryId}
                onChange={(event) => {
                  setPage(1);
                  setCategoryId(event.target.value);
                }}
                className="ck-asset-select h-9 rounded-lg border px-3 text-xs outline-none"
              >
                <option value="">全部分类</option>
                {categories.flatMap((root) =>
                  root.children.map((branch) => (
                    <optgroup key={branch.id} label={`${root.name} / ${branch.name}`}>
                      {branch.children.map((leaf) => (
                        <option key={leaf.id} value={leaf.id}>
                          {leaf.name}
                        </option>
                      ))}
                    </optgroup>
                  )),
                )}
              </select>
            )}
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
              className="ck-asset-select h-9 rounded-lg border px-3 text-xs outline-none"
            >
              <option value="">全部状态</option>
              <option value="ACTIVE">使用中</option>
              <option value="DRAFT">草稿</option>
              <option value="DISABLED">已禁用</option>
            </select>
          </div>
          <div className="ck-view-switch flex w-fit rounded-lg border p-1">
            <button
              type="button"
              aria-label="卡片视图"
              onClick={() => setView("grid")}
              className={`grid size-7 place-items-center rounded ${view === "grid" ? "is-active" : ""}`}
            >
              <Grid2X2 size={14} />
            </button>
            <button
              type="button"
              aria-label="列表视图"
              onClick={() => setView("list")}
              className={`grid size-7 place-items-center rounded ${view === "list" ? "is-active" : ""}`}
            >
              <LayoutList size={15} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid h-72 place-items-center text-zinc-600">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : activePage.items.length === 0 ? (
          <EmptyState
            tab={tab}
            onCreate={() =>
              tab === "products" ? setEditingProduct(null) : setEditingCharacter(null)
            }
          />
        ) : tab === "products" ? (
          <ProductList
            items={products.items}
            view={view}
            onEdit={setEditingProduct}
            onDelete={(item) => void remove("products", item.id, item.title)}
          />
        ) : (
          <CharacterList
            items={characters.items}
            view={view}
            onEdit={setEditingCharacter}
            onDefault={(item) => void setDefault(item)}
            onDelete={(item) => void remove("characters", item.id, item.name)}
          />
        )}

        {!loading && activePage.total > 0 && (
          <footer className="mt-6 flex items-center justify-between border-t border-white/[.07] pt-4 text-[11px] text-zinc-600">
            <span>
              共 {activePage.total} 条资产 · 第 {page} / {pageCount} 页
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={page >= pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          </footer>
        )}
      </section>

      {editingProduct !== undefined && (
        <ProductDialog
          product={editingProduct ?? undefined}
          categories={categories}
          onClose={() => setEditingProduct(undefined)}
          onSaved={() => {
            setEditingProduct(undefined);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {editingCharacter !== undefined && (
        <CharacterDialog
          character={editingCharacter ?? undefined}
          onClose={() => setEditingCharacter(undefined)}
          onSaved={() => {
            setEditingCharacter(undefined);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </main>
  );
}

function EmptyState({ tab, onCreate }: { tab: AssetTab; onCreate: () => void }) {
  const Icon = tab === "products" ? Package : UserRound;
  return (
    <div className="grid h-72 place-items-center rounded-xl border border-dashed border-white/10 bg-black/10 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-white/[.05] text-zinc-600">
          <Icon size={21} />
        </span>
        <h2 className="mt-4 text-sm font-medium text-zinc-300">
          暂无{tab === "products" ? "商品" : "形象"}
        </h2>
        <p className="mt-1.5 text-xs text-zinc-600">创建第一条资产，之后可在工作流中重复使用</p>
        <Button size="sm" className="mt-5" onClick={onCreate}>
          <Plus size={14} /> 立即创建
        </Button>
      </div>
    </div>
  );
}

function ProductList({
  items,
  view,
  onEdit,
  onDelete,
}: {
  items: ProductAsset[];
  view: ViewMode;
  onEdit: (item: ProductAsset) => void;
  onDelete: (item: ProductAsset) => void;
}) {
  return (
    <div
      className={
        view === "grid"
          ? "mt-5 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4"
          : "mt-5 space-y-2"
      }
    >
      {items.map((item) => {
        const cover = item.images[0]?.file;
        return (
          <article
            key={item.id}
            className={`ck-asset-card group overflow-hidden rounded-xl border ${view === "list" ? "flex min-h-24 items-center" : ""}`}
          >
            <div
              className={`relative shrink-0 overflow-hidden bg-black/25 ${view === "grid" ? "aspect-[1.45/1] w-full" : "ml-3 size-20 rounded-lg"}`}
            >
              {cover ? (
                <img src={cover.url} alt={item.title} className="size-full object-cover" />
              ) : (
                <Package
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-700"
                  size={25}
                />
              )}
              {view === "grid" && (
                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-zinc-300">
                  {statusLabel[item.status]}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-white">{item.title}</h3>
                  <p className="mt-1 text-[11px] text-blue-400">{item.category.name}</p>
                </div>
                <AssetMenu onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
                {item.sellingPoints[0] || "暂无商品卖点"}
              </p>
              <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-700">
                <span>{item.images.length} 张图片</span>
                <span>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CharacterList({
  items,
  view,
  onEdit,
  onDefault,
  onDelete,
}: {
  items: CharacterAsset[];
  view: ViewMode;
  onEdit: (item: CharacterAsset) => void;
  onDefault: (item: CharacterAsset) => void;
  onDelete: (item: CharacterAsset) => void;
}) {
  return (
    <div
      className={
        view === "grid"
          ? "mt-5 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4"
          : "mt-5 space-y-2"
      }
    >
      {items.map((item) => {
        const avatar = item.images[0]?.file;
        return (
          <article
            key={item.id}
            className={`ck-asset-card group overflow-hidden rounded-xl border ${view === "list" ? "flex min-h-24 items-center" : ""}`}
          >
            <div
              className={`relative shrink-0 overflow-hidden bg-black/25 ${view === "grid" ? "aspect-square w-full" : "ml-3 size-20 rounded-lg"}`}
            >
              {avatar ? (
                <img src={avatar.url} alt={item.name} className="size-full object-cover" />
              ) : (
                <UserRound
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-700"
                  size={28}
                />
              )}
              {item.isDefault && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-[10px] text-white">
                  <Star size={10} fill="currentColor" /> 默认
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-white">{item.name}</h3>
                  <p className="mt-1 text-[11px] text-zinc-600">{item.voiceName || "未绑定音色"}</p>
                </div>
                <AssetMenu
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                  extra={
                    !item.isDefault ? (
                      <button type="button" onClick={() => onDefault(item)}>
                        <Star size={13} /> 设为默认
                      </button>
                    ) : undefined
                  }
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-white/[.05] px-2 py-1 text-[10px] text-zinc-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-700">
                <span>{item.images.length} 张形象图</span>
                <span>{statusLabel[item.status]}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AssetMenu({
  onEdit,
  onDelete,
  extra,
}: {
  onEdit: () => void;
  onDelete: () => void;
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid size-7 place-items-center rounded-md text-zinc-600 hover:bg-white/[.07] hover:text-white"
        aria-label="资产操作"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="ck-asset-menu absolute right-0 top-8 z-20 w-32 rounded-lg border p-1 text-xs shadow-xl">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <Pencil size={13} /> 编辑
          </button>
          {extra}
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={13} /> 删除
          </button>
        </div>
      )}
    </div>
  );
}

function ProductDialog({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product?: ProductAsset;
  categories: ProductCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(product?.title ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [sellingPoints, setSellingPoints] = useState(product?.sellingPoints.join("\n") ?? "");
  const [audienceProfile, setAudienceProfile] = useState(product?.audienceProfile ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [sourceUrl, setSourceUrl] = useState(product?.sourceUrl ?? "");
  const [tags, setTags] = useState(product?.tags.join(", ") ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT">(
    product?.status === "DRAFT" ? "DRAFT" : "ACTIVE",
  );
  const [images, setImages] = useState<MediaAsset[]>(
    product?.images.map((image) => image.file) ?? [],
  );
  const [saving, setSaving] = useState(false);
  return (
    <AssetDialog title={product ? "编辑商品" : "添加商品"} onClose={onClose}>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ImageUploader images={images} onChange={setImages} max={20} />
        <div className="space-y-4">
          <Field label="商品标题" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="请输入商品标题"
            />
          </Field>
          <Field label="商品分类" required composite>
            <ProductCategoryCascader
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              disabled={saving}
            />
          </Field>
          <Field label="商品卖点" required hint="每行一条，最多 8 条">
            <textarea
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              className="ck-asset-form-control min-h-24 w-full rounded-lg border p-3 text-sm outline-none"
              placeholder="轻薄透气&#10;适合日常通勤"
            />
          </Field>
          <Field label="目标用户">
            <textarea
              value={audienceProfile}
              onChange={(e) => setAudienceProfile(e.target.value)}
              className="ck-asset-form-control min-h-20 w-full rounded-lg border p-3 text-sm outline-none"
            />
          </Field>
          <Field label="商品介绍">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="ck-asset-form-control min-h-24 w-full rounded-lg border p-3 text-sm outline-none"
            />
          </Field>
          <Field label="来源链接">
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label="标签" hint="使用逗号分隔">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="新品, 夏季, 通勤"
            />
          </Field>
        </div>
      </div>
      <DialogFooter
        status={status}
        setStatus={setStatus}
        saving={saving}
        onClose={onClose}
        onSave={async () => {
          setSaving(true);
          try {
            await api(product ? `/assets/products/${product.id}` : "/assets/products", {
              method: product ? "PATCH" : "POST",
              body: JSON.stringify({
                title,
                categoryId,
                sellingPoints: sellingPoints.split("\n"),
                audienceProfile,
                description,
                sourceUrl,
                tags: tags.split(","),
                status,
                imageIds: images.map((image) => image.id),
              }),
            });
            toast.success(product ? "商品已更新" : "商品已创建");
            onSaved();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
          } finally {
            setSaving(false);
          }
        }}
      />
    </AssetDialog>
  );
}

function CharacterDialog({
  character,
  onClose,
  onSaved,
}: {
  character?: CharacterAsset;
  onClose: () => void;
  onSaved: () => void;
}) {
  type GenerationConfig = { modelId: string; modelName: string; keys: number };
  type GenerationResult = {
    modelId: string;
    prompt: string;
    cost: number;
    generated: MediaAsset;
  };
  const [name, setName] = useState(character?.name ?? "");
  const [description, setDescription] = useState(character?.description ?? "");
  const [generationPrompt, setGenerationPrompt] = useState(character?.generationPrompt ?? "");
  const [voiceName, setVoiceName] = useState(character?.voiceName ?? "");
  const [tags, setTags] = useState(character?.tags.join(", ") ?? "");
  const [isDefault, setIsDefault] = useState(character?.isDefault ?? false);
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT">(
    character?.status === "DRAFT" ? "DRAFT" : "ACTIVE",
  );
  const [referenceImages, setReferenceImages] = useState<MediaAsset[]>(
    character?.referenceFile ? [character.referenceFile] : [],
  );
  const [generatedImage, setGeneratedImage] = useState<MediaAsset | undefined>(
    character?.images[0]?.file,
  );
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<GenerationConfig>("/assets/characters/generation-config")
      .then(setGenerationConfig)
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "形象生成模型加载失败"),
      );
  }, []);

  async function generate() {
    if (!referenceImages[0]) return toast.error("请先上传一张参考图");
    if (!generationPrompt.trim()) return toast.error("请填写希望生成的个人形象描述");
    if (!generationConfig) return toast.error("形象生成模型暂不可用");
    setGenerating(true);
    try {
      const result = await api<GenerationResult>("/assets/characters/generate", {
        method: "POST",
        body: JSON.stringify({
          referenceFileId: referenceImages[0].id,
          prompt: generationPrompt,
          modelId: generationConfig.modelId,
        }),
      });
      setGeneratedImage(result.generated);
      toast.success(`形象生成完成，已消耗 ${result.cost} Keys`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "形象生成失败");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AssetDialog title={character ? "编辑形象" : "创建形象"} onClose={onClose}>
      <div className="mb-5 flex items-center justify-between rounded-xl border border-blue-500/15 bg-blue-500/[.06] px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-medium text-blue-400">
          <WandSparkles size={15} /> AI 个人形象生成
        </span>
        <span className="text-[11px] text-zinc-500">
          {generationConfig
            ? `${generationConfig.modelName} · ${generationConfig.keys} Keys/次`
            : "正在加载模型…"}
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <ImageUploader
            label="参考图片"
            images={referenceImages}
            onChange={(images) => {
              setReferenceImages(images);
              setGeneratedImage(undefined);
            }}
            max={1}
            square
          />
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-300">AI 生成结果</p>
            <div className="ck-character-result relative grid aspect-square place-items-center overflow-hidden rounded-xl border">
              {generating ? (
                <span className="text-center text-zinc-500">
                  <Loader2 className="mx-auto animate-spin text-blue-400" size={24} />
                  <small className="mt-3 block">正在生成个人形象…</small>
                </span>
              ) : generatedImage ? (
                <img
                  src={generatedImage.url}
                  alt="AI 生成的个人形象"
                  className="size-full object-cover"
                />
              ) : (
                <span className="px-6 text-center text-xs leading-6 text-zinc-600">
                  上传参考图并填写描述后，点击生成
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="形象名称" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="请输入形象名称"
            />
          </Field>
          <Field label="形象生成描述" required hint="描述服装、场景、风格和镜头">
            <textarea
              value={generationPrompt}
              onChange={(e) => {
                setGenerationPrompt(e.target.value);
                setGeneratedImage(undefined);
              }}
              className="ck-asset-form-control min-h-32 w-full rounded-lg border p-3 text-sm outline-none"
              placeholder="例如：生成专业商务女性形象，深色西装，纯色摄影棚背景，正面半身照，自然光，高级真实质感"
              maxLength={1000}
            />
          </Field>
          <Field label="形象简介">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="ck-asset-form-control min-h-28 w-full rounded-lg border p-3 text-sm outline-none"
            />
          </Field>
          <Field label="音色名称">
            <Input
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="选填，后续可接入音色库"
            />
          </Field>
          <Field label="形象标签" hint="使用逗号分隔">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="年轻, 时尚, 亲和"
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/[.08] bg-black/15 p-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="accent-blue-500"
            />
            设为默认形象
          </label>
          <Button
            type="button"
            className="w-full"
            disabled={
              generating || !referenceImages[0] || !generationPrompt.trim() || !generationConfig
            }
            onClick={() => void generate()}
          >
            {generating ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <WandSparkles size={15} />
            )}
            {generatedImage ? "重新生成个人形象" : "立即生成个人形象"}
            {generationConfig ? ` · ${generationConfig.keys} Keys` : ""}
          </Button>
        </div>
      </div>
      <DialogFooter
        status={status}
        setStatus={setStatus}
        saving={saving}
        saveDisabled={!generatedImage || generating}
        onClose={onClose}
        onSave={async () => {
          setSaving(true);
          try {
            await api(character ? `/assets/characters/${character.id}` : "/assets/characters", {
              method: character ? "PATCH" : "POST",
              body: JSON.stringify({
                name,
                description,
                voiceName,
                tags: tags.split(","),
                isDefault,
                status,
                referenceFileId: referenceImages[0]?.id,
                generationPrompt,
                modelId: generationConfig?.modelId ?? character?.modelId,
                images: generatedImage ? [{ fileId: generatedImage.id, angle: "AVATAR" }] : [],
              }),
            });
            toast.success(character ? "形象已更新" : "形象已创建");
            onSaved();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
          } finally {
            setSaving(false);
          }
        }}
      />
    </AssetDialog>
  );
}

function ImageUploader({
  label = "图片",
  images,
  onChange,
  max,
  square = false,
}: {
  label?: string;
  images: MediaAsset[];
  onChange: (items: MediaAsset[]) => void;
  max: number;
  square?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (max > 1 && images.length + files.length > max) return toast.error(`最多上传 ${max} 张图片`);
    setUploading(true);
    try {
      const uploaded: MediaAsset[] = [];
      for (const file of Array.from(files)) uploaded.push(await uploadMedia<MediaAsset>(file));
      onChange(max === 1 ? [uploaded[0]] : [...images, ...uploaded]);
      toast.success("图片上传成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-300">
        {label} <span className="text-red-400">*</span>
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
        className={`ck-asset-upload relative grid w-full place-items-center overflow-hidden rounded-xl border border-dashed ${square ? "aspect-square" : "aspect-[1.3/1]"}`}
      >
        {images[0] ? (
          <img src={images[0].url} alt="主图" className="size-full object-cover" />
        ) : (
          <span className="text-center text-zinc-600">
            {uploading ? (
              <Loader2 className="mx-auto animate-spin" size={22} />
            ) : (
              <ImagePlus className="mx-auto" size={23} />
            )}
            <small className="mt-2 block text-[11px]">点击或拖入图片</small>
          </span>
        )}
        {images[0] && (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white">
            主图
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple={max > 1}
        onChange={(e) => void upload(e.target.files)}
      />
      <div className="mt-3 grid grid-cols-4 gap-2">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="relative aspect-square overflow-hidden rounded-lg bg-black/30"
          >
            <img src={image.url} alt={image.name} className="size-full object-cover" />
            <button
              type="button"
              aria-label={`移除 ${image.name}`}
              onClick={() => onChange(images.filter((item) => item.id !== image.id))}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/70 text-white"
            >
              <X size={11} />
            </button>
            {index === 0 && <Check className="absolute bottom-1 left-1 text-blue-400" size={13} />}
          </div>
        ))}
      </div>
      {images.length > 0 && images.length < max && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
          继续添加
        </Button>
      )}
      <p className="mt-2 text-[10px] text-zinc-700">
        {max === 1 ? "仅需上传 1 张形象图，重新上传会替换原图" : `第一张为主图，最多 ${max} 张`}
      </p>
    </div>
  );
}

function AssetDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <section className="ck-asset-dialog max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border shadow-2xl">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/[.07] px-6 backdrop-blur-xl">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/[.06] hover:text-white"
          >
            <X size={17} />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  composite = false,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  composite?: boolean;
  children: React.ReactNode;
}) {
  const Container = composite ? "div" : "label";
  return (
    <Container className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-zinc-300">
        <span>
          {label}
          {required && <i className="ml-1 not-italic text-red-400">*</i>}
        </span>
        {hint && <small className="font-normal text-zinc-700">{hint}</small>}
      </span>
      {children}
    </Container>
  );
}

function DialogFooter({
  status,
  setStatus,
  saving,
  saveDisabled = false,
  onClose,
  onSave,
}: {
  status: "ACTIVE" | "DRAFT";
  setStatus: (value: "ACTIVE" | "DRAFT") => void;
  saving: boolean;
  saveDisabled?: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <footer className="mt-7 flex flex-col-reverse gap-3 border-t border-white/[.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as "ACTIVE" | "DRAFT")}
        className="ck-asset-form-control h-9 rounded-lg border px-3 text-xs outline-none"
      >
        <option value="ACTIVE">保存后立即使用</option>
        <option value="DRAFT">保存为草稿</option>
      </select>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button onClick={onSave} disabled={saving || saveDisabled}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}保存
        </Button>
      </div>
    </footer>
  );
}
