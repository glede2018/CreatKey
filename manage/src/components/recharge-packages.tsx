import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { RechargePackage } from "@/pages/manage-types";

interface PackageDraft {
  name: string;
  keys: string;
  amountYuan: string;
  sortOrder: string;
  active: boolean;
}

const draftOf = (item?: RechargePackage): PackageDraft => ({
  name: item?.name ?? "",
  keys: item ? String(item.keys) : "",
  amountYuan: item ? (item.amountFen / 100).toFixed(2) : "",
  sortOrder: item ? String(item.sortOrder) : "0",
  active: item?.active ?? true,
});

function PackageForm({
  item,
  onSaved,
  onCancel,
}: {
  item?: RechargePackage;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(item));
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(item ? `/manage/recharge-packages/${item.id}` : "/manage/recharge-packages", {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify({
          name: draft.name,
          keys: Number(draft.keys),
          amountFen: Math.round(Number(draft.amountYuan) * 100),
          sortOrder: Number(draft.sortOrder),
          active: draft.active,
        }),
      });
      toast.success(item ? "套餐已更新" : "套餐已新增");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "套餐保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_.7fr_auto] lg:items-end">
      <label className="text-xs text-zinc-500">
        套餐名称
        <Input
          required
          maxLength={30}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="例如：常用包"
          className="mt-2"
        />
      </label>
      <label className="text-xs text-zinc-500">
        到账 Keys
        <Input
          required
          type="number"
          min={1}
          max={10000000}
          value={draft.keys}
          onChange={(event) => setDraft({ ...draft, keys: event.target.value })}
          className="mt-2"
        />
      </label>
      <label className="text-xs text-zinc-500">
        充值金额（元）
        <Input
          required
          type="number"
          min="0.01"
          max="1000000"
          step="0.01"
          value={draft.amountYuan}
          onChange={(event) => setDraft({ ...draft, amountYuan: event.target.value })}
          className="mt-2"
        />
      </label>
      <label className="text-xs text-zinc-500">
        排序
        <Input
          required
          type="number"
          min={0}
          max={9999}
          value={draft.sortOrder}
          onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
          className="mt-2"
        />
      </label>
      <div className="flex items-center gap-2 lg:pb-0.5">
        <label className="mr-auto flex items-center gap-2 text-xs text-zinc-400 lg:mr-2">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            className="size-4 accent-blue-500"
          />
          上架
        </label>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          保存
        </Button>
      </div>
    </form>
  );
}

/** manage 后台的 Keys 套餐配置页。 */
export function RechargePackages() {
  const [items, setItems] = useState<RechargePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<RechargePackage[]>("/manage/recharge-packages")
      .then((data) => active && setItems(data))
      .catch((error) => toast.error(error instanceof Error ? error.message : "套餐加载失败"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [revision]);

  const reload = () => {
    setAdding(false);
    setRevision((value) => value + 1);
  };

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-blue-400">
            <KeyRound size={14} /> KEYS PRICING
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">充值套餐配置</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            金额和到账 Keys 保存后会立即同步到用户价目表；已创建的订单仍保留当时价格。
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={14} /> 新增套餐
        </Button>
      </div>

      {adding && (
        <article className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/[.045] p-5">
          <PackageForm onSaved={reload} onCancel={() => setAdding(false)} />
        </article>
      )}

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="grid h-48 place-items-center text-zinc-600">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          items.map((item) => (
            <article key={`${item.id}:${item.updatedAt}`} className="rounded-2xl border border-white/[.07] bg-[#151515] p-5">
              <div className="mb-4 flex items-center justify-between border-b border-white/[.06] pb-4">
                <span className="text-xs text-zinc-500">
                  {item.active ? (
                    <b className="font-medium text-emerald-400">价目表展示中</b>
                  ) : (
                    <b className="font-medium text-zinc-600">已下架</b>
                  )}
                </span>
                <span className="font-mono text-[10px] text-zinc-700">{item.code}</span>
              </div>
              <PackageForm item={item} onSaved={reload} />
            </article>
          ))
        )}
      </div>
    </section>
  );
}
