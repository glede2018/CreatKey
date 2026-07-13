import { useEffect, useState } from "react";
import { KeyRound, MessageSquareText, ShieldCheck, Sparkles, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Role, User } from "@/types";

/** 提供制作人/商家手机号短信验证码登录界面。 */
export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [role, setRole] = useState<Role>("CREATOR");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const validPhone = /^1[3-9]\d{9}$/.test(phone);
  useEffect(() => {
    if (!countdown) return;
    const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
  /** 请求短信验证码并启动重新发送倒计时。 */
  async function sendCode() {
    if (!validPhone || countdown) return;
    setError("");
    try {
      const result = await api<{ cooldown: number }>("/auth/sms/send", {
        method: "POST",
        body: JSON.stringify({ countryCode: "+86", phone, role }),
      });
      setCountdown(result.cooldown);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "验证码发送失败");
    }
  }
  /** 提交手机号、验证码和角色，成功后交由根组件保存用户。 */
  async function login() {
    if (!validPhone || !/^\d{6}$/.test(code)) return;
    setLoading(true);
    setError("");
    try {
      onLogin(
        await api<User>("/auth/sms/verify", {
          method: "POST",
          body: JSON.stringify({ countryCode: "+86", phone, code, role }),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-grid min-h-screen bg-[#070707] text-white">
      <section className="relative hidden overflow-hidden border-r border-white/[.06] p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="noise absolute inset-0 opacity-30" />
        <div className="relative flex items-center gap-3 text-sm font-semibold tracking-[.2em]">
          <span className="grid size-9 place-items-center rounded-full bg-white text-black">
            <Sparkles size={16} />
          </span>{" "}
          CREATKEY
        </div>
        <div className="relative max-w-2xl">
          <p className="mb-6 text-xs uppercase tracking-[.32em] text-zinc-500">
            AI Workflow Studio
          </p>
          <h1 className="text-6xl font-medium leading-[1.03] tracking-[-.055em]">
            把灵感，连接成
            <br />
            <span className="text-zinc-500">可执行的创作流。</span>
          </h1>
          <p className="mt-8 max-w-lg text-base leading-7 text-zinc-500">
            组合模型、提示词与素材，在无限画布中完成从想法到成片的全过程。
          </p>
        </div>
        <div className="relative flex gap-8 text-xs text-zinc-600">
          <span>Visual workflow</span>
          <span>Model orchestration</span>
          <span>Usage based</span>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-white/10 bg-[#101010] p-7 shadow-2xl">
          <div className="mb-8">
            <h2 className="text-2xl font-medium tracking-tight">欢迎来到 CreatKey</h2>
            <p className="mt-2 text-sm text-zinc-500">使用中国大陆手机号登录或注册</p>
          </div>
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-black p-1">
            {(["CREATOR", "MERCHANT"] as Role[]).map((item) => (
              <button
                key={item}
                onClick={() => setRole(item)}
                className={`rounded-md py-2.5 text-sm transition ${role === item ? "bg-zinc-800 text-white shadow" : "text-zinc-600"}`}
              >
                {item === "CREATOR" ? "制作人" : "商家"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <label className="relative block">
              <Smartphone className="absolute left-3 top-3 text-zinc-600" size={16} />
              <span className="absolute left-10 top-2.5 border-r border-white/10 pr-3 text-sm text-zinc-300">
                +86
              </span>
              <Input
                className="h-11 pl-[5.5rem]"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={11}
                placeholder="请输入手机号"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="relative block">
              <MessageSquareText className="absolute left-3 top-3 text-zinc-600" size={16} />
              <Input
                className="h-11 pl-10 pr-28"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6 位短信验证码"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
              <button
                type="button"
                disabled={!validPhone || countdown > 0}
                onClick={sendCode}
                className="absolute right-2 top-1.5 h-8 rounded-md px-3 text-xs text-zinc-300 hover:bg-white/[.06] disabled:text-zinc-700"
              >
                {countdown ? `${countdown}s 后重发` : "获取验证码"}
              </button>
            </label>
          </div>
          {error && (
            <p className="mt-3 rounded-lg border border-red-500/15 bg-red-500/[.07] px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <Button
            className="mt-5 h-12 w-full"
            onClick={login}
            disabled={loading || !validPhone || code.length !== 6}
          >
            <KeyRound size={16} />
            {loading ? "正在登录…" : "登录 / 注册"}
          </Button>
          <p className="mt-4 text-center text-xs text-zinc-600">
            开发万能验证码：<span className="font-mono text-zinc-400">888888</span>
          </p>
          <div className="mt-7 flex items-center justify-center gap-2 text-xs text-zinc-600">
            <ShieldCheck size={13} /> 单点登录保护：新设备登录将自动退出旧设备
          </div>
        </Card>
      </section>
    </main>
  );
}
