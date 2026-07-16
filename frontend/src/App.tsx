import { useCallback, useEffect, useState } from "react";
import { LoginPage } from "@/pages/login";
import { StudioPage } from "@/pages/studio";
import { UserOnboardingDialog } from "@/components/user-onboarding-dialog";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types";

/** 应用根组件：恢复登录态并协调登录、工作台与用户资料初始化。 */
export default function App() {
  const [user, setUser] = useState<User>();
  const [ready, setReady] = useState(false);
  /** 从服务端刷新当前用户和 Keys 余额。 */
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
    return <div className="ck-app-loading grid h-screen place-items-center">CREATKEY</div>;
  const onboardingOpen = Boolean(user && !user.profileInitialized);
  return (
    <>
      <div className="contents" inert={onboardingOpen}>
        {user ? (
          <StudioPage user={user} onLogout={logout} onUserRefresh={refresh} />
        ) : (
          <LoginPage onLogin={setUser} />
        )}
      </div>
      <UserOnboardingDialog user={user} open={onboardingOpen} onComplete={setUser} />
    </>
  );
}
