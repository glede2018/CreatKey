import { useEffect, useState } from "react";
import { FolderTree, Loader2, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryDialog } from "@/components/category-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ManageProductCategory } from "@/pages/manage-types";

interface DialogState {
  category?: ManageProductCategory;
  parent?: ManageProductCategory;
}

function flattenCategories(categories: ManageProductCategory[]) {
  return categories.flatMap((root) => [
    root,
    ...root.children.flatMap((branch) => [branch, ...branch.children]),
  ]);
}

export function CategoryManagement() {
  const [categories, setCategories] = useState<ManageProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [updating, setUpdating] = useState<string>();
  const [dialog, setDialog] = useState<DialogState>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<ManageProductCategory[]>("/manage/product-categories")
      .then((result) => active && setCategories(result))
      .catch((error) => toast.error(error instanceof Error ? error.message : "分类加载失败"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [revision]);

  async function toggle(category: ManageProductCategory) {
    setUpdating(category.id);
    try {
      await api(`/manage/product-categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: category.name,
          sortOrder: category.sortOrder,
          active: !category.active,
        }),
      });
      toast.success(category.active ? "分类已停用" : "分类已启用");
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分类状态更新失败");
    } finally {
      setUpdating(undefined);
    }
  }

  async function remove(category: ManageProductCategory) {
    if (!window.confirm(`确定删除分类“${category.name}”吗？`)) return;
    setUpdating(category.id);
    try {
      await api(`/manage/product-categories/${category.id}`, { method: "DELETE" });
      toast.success("分类已删除");
      setRevision((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分类删除失败");
    } finally {
      setUpdating(undefined);
    }
  }

  const items = flattenCategories(categories);

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-blue-400">
            <FolderTree size={14} /> PRODUCT TAXONOMY
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">商品分类管理</h2>
          <p className="mt-1 text-xs text-zinc-500">
            管理商品库的三级目录。已有子分类或商品引用时不能删除。
          </p>
        </div>
        <Button onClick={() => setDialog({})}>
          <Plus size={14} /> 添加一级分类
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/[.07] bg-[#151515]">
        {loading ? (
          <div className="grid h-64 place-items-center text-zinc-600">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-zinc-600">
                <tr>
                  <th className="px-5 py-3 font-medium">分类名称</th>
                  <th className="px-5 py-3 font-medium">层级</th>
                  <th className="px-5 py-3 font-medium">编码</th>
                  <th className="px-5 py-3 font-medium">商品数量</th>
                  <th className="px-5 py-3 font-medium">排序</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((category) => (
                  <tr
                    key={category.id}
                    className="border-t border-white/[.055] hover:bg-white/[.018]"
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`flex items-center gap-2 font-medium text-zinc-200 ${
                          category.level === 1 ? "pl-0" : category.level === 2 ? "pl-6" : "pl-12"
                        }`}
                      >
                        {category.level > 1 && <i className="h-px w-3 bg-zinc-700" />}
                        {category.name}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-500">第 {category.level} 级</td>
                    <td className="px-5 py-4 font-mono text-[10px] text-zinc-600">
                      {category.code}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">{category._count.products}</td>
                    <td className="px-5 py-4 text-zinc-500">{category.sortOrder}</td>
                    <td className="px-5 py-4">
                      <Badge
                        className={
                          category.active
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                        }
                      >
                        {category.active ? "启用" : "停用"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {category.level < 3 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDialog({ parent: category })}
                          >
                            <Plus size={13} /> 子分类
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`编辑 ${category.name}`}
                          onClick={() => setDialog({ category })}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={updating === category.id}
                          aria-label={
                            category.active ? `停用 ${category.name}` : `启用 ${category.name}`
                          }
                          onClick={() => void toggle(category)}
                        >
                          {updating === category.id ? (
                            <Loader2 className="animate-spin" size={13} />
                          ) : category.active ? (
                            <PowerOff size={13} />
                          ) : (
                            <Power size={13} />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={updating === category.id}
                          aria-label={`删除 ${category.name}`}
                          className="hover:text-red-400"
                          onClick={() => void remove(category)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && (
              <div className="grid h-40 place-items-center text-xs text-zinc-600">暂无商品分类</div>
            )}
          </div>
        )}
      </div>

      {dialog && (
        <CategoryDialog
          category={dialog.category}
          parent={dialog.parent}
          onClose={() => setDialog(undefined)}
          onSaved={() => setRevision((value) => value + 1)}
        />
      )}
    </section>
  );
}
