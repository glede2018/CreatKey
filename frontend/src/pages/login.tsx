import { useEffect, useState } from "react";
import { KeyRound, MessageSquareText, ShieldCheck, Sparkles, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { User } from "@/types";

/** 提供手机号短信验证码登录界面，用户角色在首次进入首页后设置。 */
export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
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
        body: JSON.stringify({ countryCode: "+86", phone }),
      });
      setCountdown(result.cooldown);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "验证码发送失败");
    }
  }
  /** 提交手机号和验证码，成功后交由根组件保存用户。 */
  async function login() {
    if (!validPhone || !/^\d{6}$/.test(code)) return;
    setLoading(true);
    setError("");
    try {
      onLogin(
        await api<User>("/auth/sms/verify", {
          method: "POST",
          body: JSON.stringify({ countryCode: "+86", phone, code }),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-grid login-page min-h-screen">
      <section className="login-visual relative hidden overflow-hidden border-r p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="login-noise absolute inset-0 opacity-30" />
        <div className="login-brand relative flex items-center gap-3">
          <span className="login-brand-mark grid size-9 place-items-center rounded-lg">
            <Sparkles size={16} />
          </span>{" "}
          CREATKEY
        </div>
        <div className="relative max-w-2xl">
          <p className="login-eyebrow mb-6 uppercase">AI Workflow Studio</p>
          <h1 className="login-title">
            把灵感，连接成
            <br />
            <span className="login-title-muted">可执行的创作流。</span>
          </h1>
          <p className="login-copy mt-8 max-w-lg">
            组合模型、提示词与素材，在无限画布中完成从想法到成片的全过程。
          </p>
        </div>
        <div className="login-meta relative flex gap-8">
          <span>Visual workflow</span>
          <span>Model orchestration</span>
          <span>Usage based</span>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <Card className="login-card w-full max-w-md p-7">
          <div className="mb-8">
            <h2 className="ck-type-24 ck-text-primary">欢迎来到 CreatKey</h2>
            <p className="login-subtitle mt-2">使用中国大陆手机号登录或注册</p>
          </div>
          <div className="space-y-3">
            <label className="relative block">
              <Smartphone className="login-field-icon absolute left-3 top-3" size={16} />
              <span className="login-prefix absolute left-10 top-2.5 border-r pr-3">+86</span>
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
              <MessageSquareText className="login-field-icon absolute left-3 top-3" size={16} />
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
                className="login-send-code absolute right-2 top-1.5 h-8 rounded-md px-3"
              >
                {countdown ? `${countdown}s 后重发` : "获取验证码"}
              </button>
            </label>
          </div>
          {error && <p className="login-error mt-3 rounded-lg border px-3 py-2">{error}</p>}
          <Button
            className="mt-5 h-12 w-full"
            onClick={login}
            disabled={loading || !validPhone || code.length !== 6}
          >
            <KeyRound size={16} />
            {loading ? "正在登录…" : "登录 / 注册"}
          </Button>
          <p className="login-dev-note ck-text-faint mt-4 text-center">
            开发万能验证码：<span className="login-dev-code">888888</span>
          </p>
          <div className="login-footer mt-7 flex items-center justify-center gap-2">
            <ShieldCheck size={13} /> 单点登录保护：新设备登录将自动退出旧设备
          </div>
        </Card>
      </section>
    </main>
  );
}
