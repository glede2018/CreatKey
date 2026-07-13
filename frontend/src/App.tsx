import { useCallback, useEffect, useState } from "react";
import { LoginPage } from "@/pages/login";
import { StudioPage } from "@/pages/studio";
import { RechargeDialog } from "@/components/recharge-dialog";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types";

/** 应用根组件：恢复登录态，并在登录页、工作台和充值弹窗间协调状态。 */
export default function App() {
  const [user, setUser] = useState<User>();
  const [ready, setReady] = useState(false);
  const [recharge, setRecharge] = useState(false);
  /** 从服务端刷新当前用户和点数余额。 */
  const refresh = useCallback(
    () =>
      api<User>("/auth/me")
        .then(setUser)
        .catch((error) => {
          if (!(error instanceof ApiError && error.status === 401)) console.error(error);
          setUser(undefined);
        })
        .finally(() => setReady(true)),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh, Boolean(user)]);
  /** 注销服务端会话并清空本地用户状态。 */
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(undefined);
  }
  if (!ready)
    return (
      <div className="grid h-screen place-items-center bg-[#080808] text-xs tracking-[.3em] text-zinc-600">
        CREATKEY
      </div>
    );
  return (
    <>
      {user ? (
        <StudioPage user={user} onLogout={logout} onRecharge={() => setRecharge(true)} />
      ) : (
        <LoginPage onLogin={setUser} />
      )}
      <RechargeDialog open={recharge} onClose={() => setRecharge(false)} onPaid={refresh} />
    </>
  );
}
