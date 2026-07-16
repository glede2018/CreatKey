import { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { figmaIcons } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { PaymentOrder, User } from "@/types";

const money = (fen: number) =>
  `¥${(fen / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;

interface WechatPaymentDialogProps {
  initialOrder: PaymentOrder;
  user: User;
  onClose: () => void;
  onPaid: () => void;
}

/** 微信支付二维码弹窗，负责轮询支付状态及主动关单。 */
export function WechatPaymentDialog({
  initialOrder,
  user,
  onClose,
  onPaid,
}: WechatPaymentDialogProps) {
  const [order, setOrder] = useState(initialOrder);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (order.status !== "PENDING") return;
    const timer = window.setInterval(() => {
      api<PaymentOrder>(`/payments/orders/${order.id}`)
        .then((next) => {
          setOrder(next);
          if (next.status === "PAID") onPaid();
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [onPaid, order.id, order.status]);

  async function cancel() {
    if (canceling) return;
    if (order.status !== "PENDING") {
      onClose();
      return;
    }
    setCanceling(true);
    try {
      await api(`/payments/orders/${order.id}/cancel`, { method: "POST" });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "取消支付失败");
    } finally {
      setCanceling(false);
    }
  }

  async function mockPay() {
    await api(`/payments/orders/${order.id}/dev-confirm`, { method: "POST" });
    setOrder({ ...order, status: "PAID" });
    onPaid();
  }

  return (
    <div
      className="ck-dialog-backdrop fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && void cancel()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wechat-payment-title"
        className="ck-pricing-order relative w-full max-w-2xl rounded-2xl border p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={canceling}
          className="ck-dialog-dismiss absolute right-4 top-4 grid size-9 place-items-center rounded-lg"
          aria-label={order.status === "PENDING" ? "取消支付" : "关闭"}
        >
          {canceling ? <Loader2 size={16} className="animate-spin" /> : <X size={17} />}
        </button>

        {order.status === "PAID" ? (
          <div className="py-6 text-center">
            <span className="ck-dialog-success mx-auto grid size-16 place-items-center rounded-full">
              <Check size={28} />
            </span>
            <h2 id="wechat-payment-title" className="ck-dialog-success-title mt-5">
              充值成功
            </h2>
            <p className="ck-pricing-copy mt-2">{order.keys.toLocaleString("zh-CN")} Keys 已到账</p>
            <Button className="mt-6" onClick={onClose}>
              完成
            </Button>
          </div>
        ) : order.status === "CLOSED" ? (
          <div className="py-6 text-center">
            <RotateCcw className="ck-text-subtle mx-auto" size={30} />
            <h2 id="wechat-payment-title" className="mt-4 text-base font-medium">
              支付二维码已失效
            </h2>
            <p className="ck-pricing-copy mt-2">订单已取消或超过 15 分钟，请重新创建。</p>
            <Button className="mt-6" onClick={onClose}>
              重新选择
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 pr-10">
              <h2 id="wechat-payment-title" className="text-base font-medium">
                微信扫码支付
              </h2>
              <p className="ck-pricing-copy mt-1">关闭弹窗将同时取消当前待支付订单</p>
            </div>
            <div className="grid gap-7 sm:grid-cols-[224px_1fr] sm:items-center">
              <div className="ck-dialog-qr mx-auto grid size-56 place-items-center rounded-2xl p-3">
                <img src={order.qrImage} alt="微信支付二维码" className="size-full" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <img src={figmaIcons["wechat-pay"]} alt="" className="size-5" /> 微信支付
                </div>
                <dl className="ck-payment-details mt-5 divide-y rounded-xl border px-4">
                  <div className="flex justify-between gap-4 py-3">
                    <dt>用户名</dt>
                    <dd>{user.nickname}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt>手机号码</dt>
                    <dd>{user.phone}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt>充值金额</dt>
                    <dd className="ck-payment-money">{money(order.amountFen)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt>到账 Keys</dt>
                    <dd>{order.keys.toLocaleString("zh-CN")}</dd>
                  </div>
                </dl>
                <p className="ck-pricing-copy mt-4 flex items-center gap-2">
                  <ShieldCheck size={14} /> 支付结果确认后页面将自动更新
                </p>
                {order.mock && (
                  <Button className="mt-4 w-full" variant="secondary" onClick={mockPay}>
                    开发模式：模拟支付成功
                  </Button>
                )}
              </div>
            </div>
            <Button
              className="mt-6 w-full"
              variant="secondary"
              onClick={() => void cancel()}
              disabled={canceling}
            >
              {canceling && <Loader2 size={14} className="animate-spin" />}
              取消支付
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
