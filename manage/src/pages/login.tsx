import { useState } from "react";
import { KeyRound, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Admin } from "@/types";

interface LoginPageProps {
  onLogin: (admin: Admin) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onLogin(
        await api<Admin>("/manage-auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#090909] p-5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(62,99,221,.18),transparent_42%)]" />
      <section className="relative w-full max-w-[420px] rounded-3xl border border-white/[.08] bg-[#141414] p-7 shadow-[0_32px_100px_rgba(0,0,0,.55)] sm:p-9">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white text-xs font-black text-black">
            CK
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[.18em]">CREATKEY</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">OPERATIONS CENTER</p>
          </div>
        </div>
        <div className="mt-10">
          <h1 className="text-2xl font-semibold tracking-tight">登录运营后台</h1>
          <p className="mt-2 text-sm text-zinc-500">请使用独立管理员账号登录</p>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-3">
          <label className="relative block">
            <UserRound className="absolute left-3 top-3 text-zinc-600" size={16} />
            <Input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="管理员账号"
              className="h-11 pl-10"
            />
          </label>
          <label className="relative block">
            <LockKeyhole className="absolute left-3 top-3 text-zinc-600" size={16} />
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="登录密码"
              className="h-11 pl-10"
            />
          </label>
          {error && (
            <p className="rounded-lg border border-red-500/15 bg-red-500/[.07] px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <Button
            className="mt-2 h-11 w-full"
            type="submit"
            disabled={loading || !username || !password}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            {loading ? "正在验证…" : "安全登录"}
          </Button>
        </form>
        <p className="mt-7 flex items-center justify-center gap-2 text-[11px] text-zinc-600">
          <ShieldCheck size={13} /> 管理员会话与普通用户账号完全隔离
        </p>
      </section>
    </main>
  );
}
