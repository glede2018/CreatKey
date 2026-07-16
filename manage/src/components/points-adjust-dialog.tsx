import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { ManageUser } from "@/pages/manage-types";

/** Keys 人工调整弹窗属性。 */
interface PointsAdjustDialogProps {
  user?: ManageUser;
  onClose: () => void;
  onSuccess: () => void;
}

export function PointsAdjustDialog({ user, onClose, onSuccess }: PointsAdjustDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setAmount("");
    setReason("");
  }, [user]);

  if (!user) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(`/manage/users/${user!.id}/points`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(amount), reason }),
      });
      toast.success("Keys 调整成功");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Keys 调整失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-points-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#191919] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="adjust-points-title" className="text-base font-semibold text-white">
              调整用户 Keys
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {user.nickname} · 当前 {user.pointAccount?.balance ?? 0} Keys
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
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-xs text-zinc-400">
            调整数量
            <Input
              autoFocus
              required
              type="number"
              min={-100000}
              max={100000}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="增加填正数，扣减填负数"
              className="mt-2"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            调整原因
            <Input
              required
              maxLength={100}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="例如：活动补偿"
              className="mt-2"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={saving || !amount || !reason.trim()}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              确认调整
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
