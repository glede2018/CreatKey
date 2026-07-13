import { useEffect, useState } from "react";
import { Check, QrCode, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const packs = [
  { points: 100, amount: 10 },
  { points: 550, amount: 50 },
  { points: 1200, amount: 100 },
];

/** 展示充值套餐、创建扫码订单，并轮询支付结果。 */
export function RechargeDialog({
  open,
  onClose,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [pack, setPack] = useState(packs[1]);
  const [channel, setChannel] = useState<"WECHAT" | "ALIPAY">("WECHAT");
  const [order, setOrder] = useState<{
    id: string;
    status: string;
    qrUrl: string;
    qrImage: string;
    mock: boolean;
  }>();

  /** 使用当前套餐和支付渠道创建充值订单。 */
  async function createOrder() {
    setOrder(
      await api("/payments/orders", { method: "POST", body: JSON.stringify({ ...pack, channel }) }),
    );
  }

  /** 在开发模式下模拟支付成功。 */
  async function mockPay() {
    if (!order) return;
    await api(`/payments/orders/${order.id}/dev-confirm`, { method: "POST" });
    setOrder({ ...order, status: "PAID" });
    onPaid();
  }
  useEffect(() => {
    if (!order || order.status === "PAID") return;
    const timer = setInterval(
      () =>
        api<typeof order>(`/payments/orders/${order.id}`).then((next) => {
          setOrder(next);
          if (next.status === "PAID") onPaid();
        }),
      1500,
    );
    return () => clearInterval(timer);
  }, [order, onPaid]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">充值点数</h2>
            <p className="mt-1 text-xs text-zinc-500">点数用于运行工作流中的 AI 节点</p>
          </div>
          <button onClick={onClose}>
            <X className="text-zinc-500" size={18} />
          </button>
        </div>
        {!order ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {packs.map((item) => (
                <button
                  key={item.points}
                  onClick={() => setPack(item)}
                  className={`rounded-xl border p-4 text-left ${pack.points === item.points ? "border-white/40 bg-white/[.08]" : "border-white/[.07] bg-black/20"}`}
                >
                  <b className="block text-lg text-white">{item.points}</b>
                  <span className="text-xs text-zinc-600">¥ {item.amount}</span>
                </button>
              ))}
            </div>
            <div className="my-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setChannel("WECHAT")}
                className={`rounded-lg border py-3 text-sm ${channel === "WECHAT" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/[.07] text-zinc-500"}`}
              >
                微信支付
              </button>
              <button
                onClick={() => setChannel("ALIPAY")}
                className={`rounded-lg border py-3 text-sm ${channel === "ALIPAY" ? "border-blue-500/40 bg-blue-500/10 text-blue-300" : "border-white/[.07] text-zinc-500"}`}
              >
                支付宝
              </button>
            </div>
            <Button className="w-full" onClick={createOrder}>
              支付 ¥{pack.amount}
            </Button>
          </>
        ) : order.status === "PAID" ? (
          <div className="py-10 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check size={28} />
            </div>
            <h3 className="mt-4 text-white">充值成功</h3>
            <p className="mt-1 text-sm text-zinc-500">{pack.points} 点已到账</p>
            <Button className="mt-6" onClick={onClose}>
              完成
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto grid size-48 place-items-center rounded-xl bg-white p-3">
              <img src={order.qrImage} alt="支付二维码" className="size-full" />
            </div>
            <p className="mt-4 text-sm text-zinc-300">
              使用{channel === "WECHAT" ? "微信" : "支付宝"}扫码支付 ¥{pack.amount}
            </p>
            {order.mock && (
              <Button className="mt-5 w-full" variant="secondary" onClick={mockPay}>
                开发模式：模拟支付成功
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
