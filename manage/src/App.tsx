import { useCallback, useEffect, useState } from "react";
import { ManagePage } from "@/pages/manage";
import { LoginPage } from "@/pages/login";
import { api, ApiError } from "@/lib/api";
import type { Admin } from "@/types";

export default function App() {
  const [admin, setAdmin] = useState<Admin>();
  const [ready, setReady] = useState(false);
  const refresh = useCallback(
    () =>
      api<Admin>("/manage-auth/me")
        .then(setAdmin)
        .catch((error) => {
          if (!(error instanceof ApiError && error.status === 401)) console.error(error);
          setAdmin(undefined);
        })
        .finally(() => setReady(true)),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logout() {
    await api("/manage-auth/logout", { method: "POST" }).catch(() => undefined);
    setAdmin(undefined);
  }

  if (!ready)
    return (
      <div className="grid h-screen place-items-center bg-[#0b0b0b] text-xs tracking-[.25em] text-zinc-600">
        CREATKEY MANAGE
      </div>
    );
  return admin ? (
    <ManagePage
      admin={admin}
      onLogout={logout}
      onBack={() =>
        window.location.assign(import.meta.env.VITE_FRONTEND_URL ?? "http://localhost:5173")
      }
    />
  ) : (
    <LoginPage onLogin={setAdmin} />
  );
}
