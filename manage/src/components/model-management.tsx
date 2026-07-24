import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type {
  ManageModel,
  ManageModelField,
  ModelInvocation,
  PageData,
} from "@/pages/manage-types";

const capabilityLabels: Record<string, string> = {
  "ai.text-to-image": "文生图",
  "ai.image-to-image": "图生图",
  "ai.text-to-vector": "文生矢量图",
  "ai.image-to-vector": "图生矢量图",
  "ai.motion-control": "动作控制",
  "ai.text-to-video": "文生视频",
  "ai.image-to-video": "图生视频",
  "ai.video-processing": "视频处理",
  "ai.video-edit": "视频编辑",
  "ai.video-extend": "视频延长",
  "ai.video-resize": "视频改尺寸",
  "ai.reference-to-video": "参考生成视频",
  "ai.text-to-speech": "文字转语音",
};

const fieldSupportsOptions = (field: ManageModelField) =>
  field.type.toLowerCase().includes("enum") || field.type.toLowerCase().includes("boolean");

const editableFields = (fields: ManageModelField[]) =>
  fields.map((field) => ({
    ...field,
    options:
      field.options?.length || !field.type.toLowerCase().includes("boolean")
        ? (field.options ?? []).map((option) => ({ ...option }))
        : [false, true].map((value) => ({
            label: String(value),
            value,
            keysMode: "NONE" as const,
            keysValue: 0,
          })),
  }));

export function ModelManagement() {
  const [tab, setTab] = useState<"models" | "invocations">("models");
  const [items, setItems] = useState<ManageModel[]>([]);
  const [invocations, setInvocations] = useState<PageData<ModelInvocation>>();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState("");
  const [modelPage, setModelPage] = useState(1);
  const [modelTotal, setModelTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [baseKeys, setBaseKeys] = useState("0");
  const [fieldDrafts, setFieldDrafts] = useState<ManageModelField[]>([]);
  const [activeFieldKey, setActiveFieldKey] = useState<string>();
  const [saving, setSaving] = useState(false);

  const loadModels = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (query.trim()) params.set("query", query.trim());
        if (capabilityFilter) params.set("capability", capabilityFilter);
        const result = await api<PageData<ManageModel>>(`/manage/models?${params.toString()}`);
        setItems(result.items);
        setModelTotal(result.total);
        setModelPage(result.page);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "模型列表加载失败");
      } finally {
        setLoading(false);
      }
    },
    [capabilityFilter, query],
  );

  const loadInvocations = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      setInvocations(
        await api<PageData<ModelInvocation>>(`/manage/model-invocations?page=${page}`),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "调用记录加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "models") return;
    const timer = window.setTimeout(() => void loadModels(modelPage), 250);
    return () => window.clearTimeout(timer);
  }, [loadModels, modelPage, tab]);
  useEffect(() => {
    if (tab === "invocations") void loadInvocations();
  }, [loadInvocations, tab]);

  const selected = items.find((item) => item.providerModelId === selectedId);
  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setSelectedId(undefined);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [saving, selected]);
  function editModel(item: ManageModel) {
    setSelectedId(item.providerModelId);
    setBaseKeys(String(item.baseKeys));
    const drafts = editableFields(item.fields);
    setFieldDrafts(drafts);
    setActiveFieldKey(drafts[0]?.key);
  }

  async function toggle(item: ManageModel) {
    try {
      await api(`/manage/models/${encodeURIComponent(item.providerModelId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      await loadModels(modelPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  async function savePricing() {
    if (!selected) return;
    const normalizedBaseKeys = Number(baseKeys);
    if (!Number.isInteger(normalizedBaseKeys) || normalizedBaseKeys < 0) {
      toast.error("基础 Keys 必须是非负整数");
      return;
    }
    if (
      fieldDrafts.some((field) =>
        (field.options ?? []).some(
          (option) => !Number.isInteger(option.keysValue) || option.keysValue < 0,
        ),
      )
    ) {
      toast.error("选项 Keys 必须是非负整数");
      return;
    }
    setSaving(true);
    try {
      const saved = await api<ManageModel>(
        `/manage/models/${encodeURIComponent(selected.providerModelId)}/costs`,
        {
          method: "PATCH",
          body: JSON.stringify({ baseKeys: normalizedBaseKeys, fields: fieldDrafts }),
        },
      );
      setItems((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      toast.success("Keys 定价已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "定价保存失败");
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: string, patch: Partial<ManageModelField>) {
    setFieldDrafts((current) =>
      current.map((field) => (field.key === key ? { ...field, ...patch } : field)),
    );
  }

  function updateOption(
    fieldKey: string,
    optionIndex: number,
    patch: Partial<NonNullable<ManageModelField["options"]>[number]>,
  ) {
    setFieldDrafts((current) =>
      current.map((field) =>
        field.key === fieldKey
          ? (() => {
              const previousValue = field.options?.[optionIndex]?.value;
              return {
                ...field,
                ...(patch.value !== undefined && previousValue === field.default
                  ? { default: patch.value }
                  : {}),
                options: (field.options ?? []).map((option, index) =>
                  index === optionIndex ? { ...option, ...patch } : option,
                ),
              };
            })()
          : field,
      ),
    );
  }

  function addOption(field: ManageModelField) {
    const numeric =
      field.type.toLowerCase().includes("int") || field.type.toLowerCase().includes("number");
    updateField(field.key, {
      options: [
        ...(field.options ?? []),
        { label: "新选项", value: numeric ? 0 : "", keysMode: "NONE", keysValue: 0 },
      ],
    });
  }

  function removeOption(field: ManageModelField, optionIndex: number) {
    const removed = field.options?.[optionIndex];
    const options = (field.options ?? []).filter((_, index) => index !== optionIndex);
    updateField(field.key, {
      options,
      ...(removed?.value === field.default ? { default: options[0]?.value ?? "" } : {}),
    });
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-violet-400">
            <Bot size={14} /> AKOOL MAAS
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">模型管理</h2>
          <p className="mt-1 text-xs text-zinc-500">模型参数、Keys 定价与 Akool 实际扣费审计</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-black/20 p-1 text-xs">
          <button
            className={`rounded-md px-3 py-2 ${tab === "models" ? "bg-white/10 text-white" : "text-zinc-500"}`}
            onClick={() => setTab("models")}
          >
            模型配置
          </button>
          <button
            className={`rounded-md px-3 py-2 ${tab === "invocations" ? "bg-white/10 text-white" : "text-zinc-500"}`}
            onClick={() => setTab("invocations")}
          >
            调用记录
          </button>
        </div>
      </div>

      {tab === "models" ? (
        <>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block w-full max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                size={14}
              />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setModelPage(1);
                }}
                placeholder="搜索模型 ID、名称或厂商"
                className="h-9 pl-9"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="shrink-0">内部能力</span>
              <select
                value={capabilityFilter}
                onChange={(event) => {
                  setCapabilityFilter(event.target.value);
                  setModelPage(1);
                }}
                className="h-9 min-w-44 rounded-md border border-white/10 bg-[#151515] px-3 text-xs text-zinc-300"
              >
                <option value="">全部能力</option>
                {Object.entries(capabilityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-zinc-600">共 {modelTotal} 个模型</span>
          </div>
          {selected && (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !saving) setSelectedId(undefined);
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="model-pricing-dialog-title"
                className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-violet-500/20 bg-[#151515] p-5 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="model-pricing-dialog-title" className="font-medium text-white">
                      {selected.name}
                    </h3>
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">
                      {selected.providerModelId}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setSelectedId(undefined)}
                    className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/[.06] hover:text-white disabled:opacity-40"
                    aria-label="关闭参数与 Keys 设置"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-5 grid min-h-[520px] gap-5 lg:grid-cols-[260px_1fr]">
                  <aside className="overflow-hidden rounded-xl border border-white/[.07] bg-black/20">
                    <div className="border-b border-white/[.07] p-3">
                      <label className="text-xs text-zinc-400">
                        模型基础 Keys
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={baseKeys}
                          onChange={(event) => setBaseKeys(event.target.value)}
                          className="mt-2"
                        />
                      </label>
                    </div>
                    <div className="max-h-[430px] overflow-y-auto p-2">
                      {fieldDrafts.map((field) => (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() => setActiveFieldKey(field.key)}
                          className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-xs transition ${
                            activeFieldKey === field.key
                              ? "bg-violet-500/15 text-violet-200"
                              : "text-zinc-500 hover:bg-white/[.04] hover:text-zinc-300"
                          }`}
                        >
                          <span className="block truncate font-mono">{field.key}</span>
                          <span className="mt-1 block text-[10px] opacity-60">
                            {field.type} · {field.options?.length ?? 0} 个选项
                          </span>
                        </button>
                      ))}
                    </div>
                  </aside>

                  {fieldDrafts
                    .filter((field) => field.key === activeFieldKey)
                    .map((field) => {
                      const supportsOptions = fieldSupportsOptions(field);
                      const defaultOptionIndex = (field.options ?? []).findIndex(
                        (option) => option.value === field.default,
                      );
                      const numeric =
                        field.type.toLowerCase().includes("int") ||
                        field.type.toLowerCase().includes("number");
                      const boolean = field.type.toLowerCase().includes("boolean");
                      return (
                        <div key={field.key} className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="text-sm text-violet-300">{field.key}</code>
                            <Badge>{field.type}</Badge>
                            {field.required && <span className="text-xs text-rose-400">必填</span>}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-zinc-500">
                            {field.description || field.range || "暂无参数说明"}
                          </p>

                          <div className="mt-5 max-w-sm">
                            <label className="text-xs text-zinc-400">
                              默认值
                              {supportsOptions && (field.options?.length ?? 0) > 0 ? (
                                <select
                                  value={defaultOptionIndex}
                                  onChange={(event) =>
                                    updateField(field.key, {
                                      default: field.options?.[Number(event.target.value)]?.value,
                                    })
                                  }
                                  className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-xs text-zinc-300"
                                >
                                  <option value={-1}>无默认值</option>
                                  {(field.options ?? []).map((option, index) => (
                                    <option key={`${String(option.value)}-${index}`} value={index}>
                                      {option.label || String(option.value)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  type={numeric ? "number" : "text"}
                                  value={String(field.default ?? "")}
                                  onChange={(event) =>
                                    updateField(field.key, {
                                      default: numeric
                                        ? Number(event.target.value)
                                        : event.target.value,
                                    })
                                  }
                                  className="mt-2"
                                />
                              )}
                            </label>
                          </div>

                          {supportsOptions && (
                            <div className="mt-6">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h4 className="text-xs font-medium text-zinc-300">
                                    参数选项与 Keys
                                  </h4>
                                  <p className="mt-1 text-[10px] text-zinc-600">
                                    “直接设为”覆盖当前 Keys；“当前 +”在已有 Keys 上累加。
                                  </p>
                                </div>
                                {!boolean && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => addOption(field)}
                                  >
                                    <Plus size={13} /> 添加选项
                                  </Button>
                                )}
                              </div>
                              <div className="mt-3 overflow-x-auto rounded-xl border border-white/[.07]">
                                <table className="w-full min-w-[680px] text-left text-xs">
                                  <thead className="bg-white/[.025] text-[10px] text-zinc-600">
                                    <tr>
                                      <th className="px-3 py-2.5">显示名称</th>
                                      <th className="px-3 py-2.5">API 值</th>
                                      <th className="px-3 py-2.5">Keys 方式</th>
                                      <th className="px-3 py-2.5">Keys 数值</th>
                                      <th className="w-10 px-2 py-2.5" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(field.options ?? []).map((option, optionIndex) => (
                                      <tr
                                        key={`${String(option.value)}-${optionIndex}`}
                                        className="border-t border-white/[.055]"
                                      >
                                        <td className="p-2">
                                          <Input
                                            value={option.label}
                                            onChange={(event) =>
                                              updateOption(field.key, optionIndex, {
                                                label: event.target.value,
                                              })
                                            }
                                          />
                                        </td>
                                        <td className="p-2">
                                          {boolean ? (
                                            <code className="px-3 text-zinc-400">
                                              {String(option.value)}
                                            </code>
                                          ) : (
                                            <Input
                                              type={numeric ? "number" : "text"}
                                              value={String(option.value)}
                                              onChange={(event) =>
                                                updateOption(field.key, optionIndex, {
                                                  value: numeric
                                                    ? Number(event.target.value)
                                                    : event.target.value,
                                                })
                                              }
                                            />
                                          )}
                                        </td>
                                        <td className="p-2">
                                          <select
                                            value={option.keysMode}
                                            onChange={(event) =>
                                              updateOption(field.key, optionIndex, {
                                                keysMode: event.target
                                                  .value as typeof option.keysMode,
                                              })
                                            }
                                            className="h-9 w-full rounded-md border border-white/10 bg-black/30 px-2 text-xs text-zinc-300"
                                          >
                                            <option value="NONE">不调整</option>
                                            <option value="SET">直接设为</option>
                                            <option value="ADD">当前 +</option>
                                          </select>
                                        </td>
                                        <td className="p-2">
                                          <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            disabled={option.keysMode === "NONE"}
                                            value={option.keysValue}
                                            onChange={(event) =>
                                              updateOption(field.key, optionIndex, {
                                                keysValue: Number(event.target.value),
                                              })
                                            }
                                          />
                                        </td>
                                        <td className="p-2 text-center">
                                          {!boolean && (
                                            <button
                                              type="button"
                                              aria-label={`删除 ${option.label || option.value} 选项`}
                                              onClick={() => removeOption(field, optionIndex)}
                                              className="text-zinc-600 hover:text-rose-400"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
                <div className="mt-5 flex items-center justify-end gap-2 border-t border-white/[.07] pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setSelectedId(undefined)}
                  >
                    取消
                  </Button>
                  <Button size="sm" disabled={saving} onClick={savePricing}>
                    {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                    保存参数与 Keys
                  </Button>
                </div>
              </section>
            </div>
          )}
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#151515]">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-white/[.025] text-zinc-600">
                <tr>
                  <th className="px-5 py-3">模型</th>
                  <th className="px-5 py-3">厂商</th>
                  <th className="px-5 py-3">内部能力</th>
                  <th className="px-5 py-3">参数</th>
                  <th className="px-5 py-3">基础 Keys</th>
                  <th className="px-5 py-3">状态 / 操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-white/[.055]">
                    <td className="px-5 py-4">
                      <b className="text-zinc-200">{item.providerModelId}</b>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">{item.vendor}</td>
                    <td className="px-5 py-4">
                      <Badge>{capabilityLabels[item.capability] ?? item.capability}</Badge>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">{item.fields.length} 个</td>
                    <td className="px-5 py-4 font-mono text-zinc-300">{item.baseKeys}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => editModel(item)}>
                          参数与 Keys
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => toggle(item)}>
                          {item.active ? "下架" : "上架"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {modelTotal > 20 && (
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
              <span>
                第 {modelPage} / {Math.ceil(modelTotal / 20)} 页，每页 20 条
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading || modelPage <= 1}
                  onClick={() => setModelPage((page) => Math.max(1, page - 1))}
                >
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading || modelPage * 20 >= modelTotal}
                  onClick={() => setModelPage((page) => page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      ) : loading ? (
        <div className="grid h-64 place-items-center">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[.07] bg-[#151515]">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="bg-white/[.025] text-zinc-600">
              <tr>
                <th className="px-5 py-3">时间 / 状态</th>
                <th className="px-5 py-3">模型</th>
                <th className="px-5 py-3">用户</th>
                <th className="px-5 py-3">Keys</th>
                <th className="px-5 py-3">Akool USD</th>
                <th className="px-5 py-3">请求与计价快照</th>
              </tr>
            </thead>
            <tbody>
              {invocations?.items.map((item) => (
                <tr key={item.id} className="border-t border-white/[.055] align-top">
                  <td className="px-5 py-4">
                    <Badge>{item.status}</Badge>
                    <div className="mt-2 text-[10px] text-zinc-600">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <b className="text-zinc-300">{item.model.name}</b>
                    <div className="mt-1 font-mono text-[10px] text-zinc-600">
                      {item.model.providerModelId}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-zinc-400">
                    {item.user ? `${item.user.nickname} · ${item.user.phone}` : "—"}
                  </td>
                  <td className="px-5 py-4 font-mono text-zinc-300">
                    {item.chargedKeys}
                    {item.refundedKeys ? ` / 退 ${item.refundedKeys}` : ""}
                  </td>
                  <td className="px-5 py-4 font-mono text-amber-300">
                    {item.providerAmountUsd ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    <details>
                      <summary className="cursor-pointer text-violet-400">查看详情</summary>
                      <pre className="mt-2 max-h-64 max-w-xl overflow-auto whitespace-pre-wrap rounded bg-black/30 p-3 text-[10px] text-zinc-400">
                        {JSON.stringify(
                          {
                            requestParams: item.requestParams,
                            pricingSnapshot: item.pricingSnapshot,
                            taskUuid: item.providerTaskUuid,
                            error: item.errorMessage,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invocations && invocations.total > invocations.pageSize && (
            <div className="flex justify-end gap-2 border-t border-white/[.05] p-3">
              <Button
                size="sm"
                variant="secondary"
                disabled={invocations.page <= 1}
                onClick={() => loadInvocations(invocations.page - 1)}
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={invocations.page * invocations.pageSize >= invocations.total}
                onClick={() => loadInvocations(invocations.page + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
