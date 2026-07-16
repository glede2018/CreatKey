import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { figmaIcons } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { WechatPaymentDialog } from "@/components/wechat-payment-dialog";
import { api } from "@/lib/api";
import type { PaymentOrder, RechargePackage, User } from "@/types";

const money = (fen: number) =>
  `¥${(fen / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;

/** 价目表页面：展示后台配置的套餐并创建微信支付订单。 */
export function PricingPage({ user, onPaid }: { user: User; onPaid: () => void }) {
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [order, setOrder] = useState<PaymentOrder>();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    api<RechargePackage[]>("/payments/packages")
      .then((items) => {
        if (!active) return;
        setPackages(items);
        setSelectedId((current) => current || items[0]?.id || "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "价目表加载失败"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const selected = packages.find((item) => item.id === selectedId);

  async function createOrder() {
    if (!selected) return;
    setCreating(true);
    try {
      setOrder(
        await api<PaymentOrder>("/payments/orders", {
          method: "POST",
          body: JSON.stringify({ packageId: selected.id }),
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "微信支付订单创建失败");
    } finally {
      setCreating(false);
    }
  }

  if (loading)
    return (
      <main className="grid min-w-0 flex-1 place-items-center" aria-label="价目表页面">
        <Loader2 className="ck-text-faint animate-spin" size={22} />
      </main>
    );

  return (
    <main className="ck-pricing min-w-0 flex-1 overflow-y-auto px-5 py-10" aria-label="价目表页面">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="ck-pricing-kicker inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
            <KeyRound size={13} /> CREATKEY KEYS
          </span>
          <h1 className="ck-pricing-title mt-5">为创作补充 Keys</h1>
          <p className="ck-pricing-copy mx-auto mt-3 max-w-xl">
            Keys 用于运行工作流中的 AI 节点。选择套餐后使用微信扫码，支付成功将自动到账。
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {packages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`ck-pricing-card rounded-2xl border p-6 text-left transition ${selectedId === item.id ? "is-active" : ""}`}
            >
              <span className="ck-pricing-pack-name">{item.name}</span>
              <strong className="ck-pricing-keys mt-5 block">
                {item.keys.toLocaleString("zh-CN")}
                <small> Keys</small>
              </strong>
              <span className="ck-pricing-amount mt-2 block">{money(item.amountFen)}</span>
              <span className="ck-pricing-choice mt-6 flex items-center gap-2">
                <i className="grid size-5 place-items-center rounded-full border">
                  {selectedId === item.id && <Check size={12} />}
                </i>
                {selectedId === item.id ? "已选择" : "选择套餐"}
              </span>
            </button>
          ))}
        </div>
        {packages.length ? (
          <section className="ck-pricing-checkout mt-5 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="ck-wechat-icon grid size-11 place-items-center rounded-xl">
                <img src={figmaIcons["wechat-pay"]} alt="" className="size-6" />
              </span>
              <span>
                <b className="block text-sm font-medium">微信支付</b>
                <small className="ck-pricing-copy mt-1 block">安全支付 · 自动到账</small>
              </span>
            </div>
            <Button onClick={createOrder} disabled={!selected || creating} className="min-w-40">
              {creating && <Loader2 size={14} className="animate-spin" />}支付{" "}
              {selected ? money(selected.amountFen) : ""}
            </Button>
          </section>
        ) : (
          <div className="ck-pricing-empty mt-10 rounded-2xl border border-dashed p-12 text-center">
            暂无可购买套餐，请稍后再试
          </div>
        )}
        <p className="ck-pricing-balance mt-6 text-center text-xs">
          当前余额：{user.keys.toLocaleString("zh-CN")} Keys
        </p>
      </div>
      {order && (
        <WechatPaymentDialog
          initialOrder={order}
          user={user}
          onPaid={onPaid}
          onClose={() => setOrder(undefined)}
        />
      )}
    </main>
  );
}
