import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { ManageProductCategory } from "@/pages/manage-types";

interface CategoryDialogProps {
  category?: ManageProductCategory;
  parent?: ManageProductCategory;
  onClose: () => void;
  onSaved: () => void;
}

export function CategoryDialog({ category, parent, onClose, onSaved }: CategoryDialogProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [active, setActive] = useState(category?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(
        category ? `/manage/product-categories/${category.id}` : "/manage/product-categories",
        {
          method: category ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            sortOrder: Number(sortOrder),
            active,
            ...(!category && parent ? { parentId: parent.id } : {}),
          }),
        },
      );
      toast.success(category ? "分类已更新" : "分类已添加");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分类保存失败");
    } finally {
      setSaving(false);
    }
  }

  const nextLevel = category?.level ?? (parent ? parent.level + 1 : 1);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-dialog-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#191919] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="category-dialog-title" className="text-base font-semibold text-white">
              {category ? "编辑分类" : parent ? "添加子分类" : "添加一级分类"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              第 {nextLevel} 级{parent ? ` · 上级：${parent.name}` : " · 无上级分类"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/[.06] hover:text-white"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-xs text-zinc-400">
            分类名称
            <Input
              autoFocus
              required
              maxLength={30}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入分类名称"
              className="mt-2"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            排序
            <Input
              required
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="mt-2"
            />
            <span className="mt-1.5 block text-[10px] text-zinc-600">数值越小越靠前</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="size-4 rounded border-white/10 bg-black/40 accent-white"
            />
            启用该分类
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || sortOrder === ""}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              保存
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
