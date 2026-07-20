import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { ManageModel } from "@/pages/manage-types";

const capabilityLabels: Record<string, string> = {
  "ai.speech-to-text": "语音识别",
  "ai.multimodal-to-text": "多模态文本",
  "ai.text-to-image": "文生图",
  "ai.image-to-image": "图生图",
  "ai.multi-image-to-image": "多图生图",
  "ai.text-to-speech": "文字转语音",
  "ai.music-generation": "音乐生成",
  "ai.text-to-video": "文生视频",
  "ai.image-to-video": "图生视频",
};

/** manage 后台的模型上下架管理页。 */
export function ModelManagement() {
  const [items, setItems] = useState<ManageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string>();
  const [savingCosts, setSavingCosts] = useState<string>();
  const [costDrafts, setCostDrafts] = useState<Record<string, Record<string, string>>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    api<ManageModel[]>("/manage/models")
      .then((models) => {
        if (!active) return;
        setItems(models);
        setCostDrafts(
          Object.fromEntries(
            models.map((model) => [
              model.id,
              Object.fromEntries(
                model.capabilities.map((capability) => [
                  capability,
                  String(model.capabilityKeys[capability] ?? 0),
                ]),
              ),
            ]),
          ),
        );
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "模型列表加载失败"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.name, item.id, item.provider, ...item.capabilities].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [items, query]);

  async function toggle(item: ManageModel) {
    const active = !item.active;
    setUpdating(item.id);
    try {
      await api(`/manage/models/${encodeURIComponent(item.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      setItems((current) =>
        current.map((model) => (model.id === item.id ? { ...model, active } : model)),
      );
      toast.success(`${item.name} 已${active ? "上架" : "下架"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "模型状态更新失败");
    } finally {
      setUpdating(undefined);
    }
  }

  async function saveCosts(item: ManageModel) {
    const capabilityKeys = Object.fromEntries(
      item.capabilities.map((capability) => [
        capability,
        Number(costDrafts[item.id]?.[capability]),
      ]),
    );
    if (Object.values(capabilityKeys).some((keys) => !Number.isInteger(keys) || keys < 0)) {
      toast.error("Keys 必须是大于或等于 0 的整数");
      return;
    }
    setSavingCosts(item.id);
    try {
      await api(`/manage/models/${encodeURIComponent(item.id)}/costs`, {
        method: "PATCH",
        body: JSON.stringify({ capabilityKeys }),
      });
      setItems((current) =>
        current.map((model) => (model.id === item.id ? { ...model, capabilityKeys } : model)),
      );
      toast.success(`${item.name} 的 Keys 价格已保存`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "模型价格保存失败");
    } finally {
      setSavingCosts(undefined);
    }
  }

  const activeCount = items.filter((item) => item.active).length;

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-violet-400">
            <Bot size={14} /> AI MODEL CATALOG
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">模型管理</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            已上架 {activeCount} / {items.length} 个模型。下架后将从创作端隐藏，并停止新的模型调用。
          </p>
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">搜索模型</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模型、ID 或能力"
            className="h-9 pl-9"
          />
        </label>
      </div>

      {loading ? (
        <div className="grid h-64 place-items-center text-zinc-600">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/[.07] bg-[#151515]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-zinc-600">
                <tr>
                  <th className="px-5 py-3 font-medium">模型</th>
                  <th className="px-5 py-3 font-medium">厂商</th>
                  <th className="px-5 py-3 font-medium">能力 / 消耗 Keys</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-white/[.055] hover:bg-white/[.018]">
                    <td className="px-5 py-4">
                      <b className="block font-medium text-zinc-200">{item.name}</b>
                      <small className="mt-1 block font-mono text-[10px] text-zinc-600">
                        {item.id}
                      </small>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">{item.provider}</td>
                    <td className="max-w-md px-5 py-4">
                      <div className="grid gap-2">
                        {item.capabilities.map((capability) => (
                          <label key={capability} className="flex items-center gap-2">
                            <Badge className="min-w-24 border-white/10 bg-white/[.04] text-zinc-400">
                              {capabilityLabels[capability] ?? capability}
                            </Badge>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              aria-label={`${capabilityLabels[capability] ?? capability} 消耗 Keys`}
                              value={costDrafts[item.id]?.[capability] ?? ""}
                              onChange={(event) =>
                                setCostDrafts((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...current[item.id],
                                    [capability]: event.target.value,
                                  },
                                }))
                              }
                              className="h-8 w-24 font-mono"
                            />
                            <span className="text-[10px] text-zinc-600">Keys</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        className={
                          item.active
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-zinc-500/20 bg-zinc-500/10 text-zinc-500"
                        }
                      >
                        {item.active ? "已上架" : "已下架"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={savingCosts === item.id}
                          onClick={() => saveCosts(item)}
                        >
                          {savingCosts === item.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Save size={13} />
                          )}
                          保存价格
                        </Button>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.active}
                          aria-label={`${item.active ? "下架" : "上架"} ${item.name}`}
                          disabled={updating === item.id}
                          onClick={() => toggle(item)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:cursor-wait disabled:opacity-50 ${
                            item.active ? "bg-emerald-500" : "bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`size-4 rounded-full bg-white shadow transition-transform ${
                              item.active ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredItems.length && (
            <div className="grid h-40 place-items-center border-t border-white/[.055] text-xs text-zinc-600">
              暂无符合条件的模型
            </div>
          )}
        </div>
      )}
    </section>
  );
}
