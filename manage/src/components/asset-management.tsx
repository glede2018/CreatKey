import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Image,
  Loader2,
  Search,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type {
  ManageCharacterAsset,
  ManageProductAsset,
  ManageAssetStatus,
  PageData,
} from "@/pages/manage-types";

type AssetType = "products" | "characters";

const statusLabel: Record<ManageAssetStatus, string> = {
  ACTIVE: "使用中",
  DRAFT: "草稿",
  DISABLED: "已禁用",
};

export function AssetManagement() {
  const [type, setType] = useState<AssetType>("products");
  const [data, setData] = useState<PageData<ManageProductAsset | ManageCharacterAsset>>();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [updating, setUpdating] = useState<string>();

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));
    setLoading(true);
    api<PageData<ManageProductAsset | ManageCharacterAsset>>(
      `/manage/assets/${type}${params.size ? `?${params}` : ""}`,
    )
      .then((result) => active && setData(result))
      .catch((error) => toast.error(error instanceof Error ? error.message : "资产加载失败"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, query, revision, status, type]);

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 15)));

  async function toggle(item: ManageProductAsset | ManageCharacterAsset) {
    const next = item.status === "DISABLED" ? "ACTIVE" : "DISABLED";
    setUpdating(item.id);
    try {
      await api(`/manage/assets/${type}/${item.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(next === "DISABLED" ? "资产已禁用" : "资产已恢复");
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setUpdating(undefined);
    }
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-blue-400">
            <Image size={14} /> ASSET MODERATION
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">资产管理</h2>
          <p className="mt-1 text-xs text-zinc-500">查看全站商品和形象，处理不合规资产。</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-[#151515] p-1">
          {(["products", "characters"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setType(item);
                setPage(1);
              }}
              className={`rounded-md px-4 py-2 text-xs ${type === item ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}
            >
              {item === "products" ? "商品" : "形象"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/[.07] bg-[#151515]">
        <div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:items-center sm:justify-between">
          <form
            className="relative w-full sm:w-72"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQuery(search.trim());
            }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索资产、用户或手机号"
              className="h-9 pl-9"
            />
          </form>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="h-9 rounded-lg border border-white/10 bg-[#1d1d1d] px-3 text-xs text-zinc-300 outline-none"
          >
            <option value="">全部状态</option>
            <option value="ACTIVE">使用中</option>
            <option value="DRAFT">草稿</option>
            <option value="DISABLED">已禁用</option>
          </select>
        </div>

        {loading ? (
          <div className="grid h-64 place-items-center text-zinc-600">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-zinc-600">
                <tr>
                  <th className="px-5 py-3 font-medium">资产</th>
                  <th className="px-5 py-3 font-medium">所属用户</th>
                  <th className="px-5 py-3 font-medium">分类 / 信息</th>
                  <th className="px-5 py-3 font-medium">图片</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 font-medium">更新时间</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => {
                  const product = type === "products" ? (item as ManageProductAsset) : undefined;
                  const character =
                    type === "characters" ? (item as ManageCharacterAsset) : undefined;
                  const cover = item.images[0]?.file;
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-white/[.055] hover:bg-white/[.018]"
                    >
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-3">
                          {cover ? (
                            <img
                              src={cover.url}
                              alt=""
                              className="size-11 rounded-lg object-cover"
                            />
                          ) : (
                            <i className="grid size-11 place-items-center rounded-lg bg-white/[.05] text-zinc-700">
                              <Image size={16} />
                            </i>
                          )}
                          <span>
                            <b className="block max-w-48 truncate font-medium text-zinc-200">
                              {product?.title ?? character?.name}
                            </b>
                            <small className="mt-1 block font-mono text-[9px] text-zinc-700">
                              {item.id.slice(0, 8)}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-zinc-300">{item.owner.nickname}</span>
                        <small className="mt-1 block text-[10px] text-zinc-600">
                          {item.owner.phone}
                        </small>
                      </td>
                      <td className="px-5 py-4 text-zinc-500">
                        {product?.category.name ?? (character?.voiceName || "未绑定音色")}
                      </td>
                      <td className="px-5 py-4 text-zinc-500">{item.images.length} 张</td>
                      <td className="px-5 py-4">
                        <Badge
                          className={
                            item.status === "ACTIVE"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : item.status === "DISABLED"
                                ? "border-red-500/20 bg-red-500/10 text-red-400"
                                : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                          }
                        >
                          {statusLabel[item.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-zinc-500">
                        {new Date(item.updatedAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={updating === item.id || item.status === "DRAFT"}
                          onClick={() => toggle(item)}
                        >
                          {updating === item.id ? (
                            <Loader2 className="animate-spin" size={13} />
                          ) : item.status === "DISABLED" ? (
                            <ShieldCheck size={13} />
                          ) : (
                            <ShieldBan size={13} />
                          )}
                          {item.status === "DISABLED" ? "恢复" : "禁用"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!data?.items.length && (
              <div className="grid h-40 place-items-center text-xs text-zinc-600">
                暂无符合条件的资产
              </div>
            )}
          </div>
        )}
        <footer className="flex items-center justify-between border-t border-white/[.07] px-5 py-4 text-[11px] text-zinc-600">
          <span>
            共 {data?.total ?? 0} 条 · 第 {page} / {pageCount} 页
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </footer>
      </div>
    </section>
  );
}
