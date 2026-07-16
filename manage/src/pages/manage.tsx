import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Coins,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { ManageStatCard } from "@/components/manage-stat-card";
import { PointsAdjustDialog } from "@/components/points-adjust-dialog";
import { RechargePackages } from "@/components/recharge-packages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Admin } from "@/types";
import type {
  ManagePayment,
  ManageRun,
  ManageSection,
  ManageUser,
  OverviewData,
  PageData,
} from "./manage-types";

/** 独立运营后台的主页面属性。 */
interface ManagePageProps {
  admin: Admin;
  onBack: () => void;
  onLogout: () => void;
}

const navItems = [
  { id: "overview", label: "数据概览", icon: LayoutDashboard },
  { id: "users", label: "用户管理", icon: Users },
  { id: "runs", label: "运行记录", icon: Activity },
  { id: "payments", label: "充值订单", icon: CircleDollarSign },
  { id: "packages", label: "Keys 套餐", icon: KeyRound },
] as const;

const statusText: Record<string, string> = {
  PENDING: "等待中",
  RUNNING: "运行中",
  SUCCEEDED: "已成功",
  FAILED: "失败",
  CANCELED: "已取消",
  PAID: "已支付",
  CLOSED: "已关闭",
  REFUNDED: "已退款",
};

const statusClass: Record<string, string> = {
  RUNNING: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  SUCCEEDED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  PAID: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  FAILED: "border-red-500/20 bg-red-500/10 text-red-400",
  CANCELED: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  CLOSED: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  REFUNDED: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  PENDING: "border-amber-500/20 bg-amber-500/10 text-amber-400",
};

const number = new Intl.NumberFormat("zh-CN");
const money = (fen: number) =>
  `¥${(fen / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
const time = (value?: string) =>
  value
    ? new Date(value).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function ManagePage({ admin, onBack, onLogout }: ManagePageProps) {
  const [section, setSection] = useState<ManageSection>("overview");
  const [overview, setOverview] = useState<OverviewData>();
  const [users, setUsers] = useState<PageData<ManageUser>>();
  const [runs, setRuns] = useState<PageData<ManageRun>>();
  const [payments, setPayments] = useState<PageData<ManagePayment>>();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<ManageUser>();
  const [updatingRole, setUpdatingRole] = useState<string>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (section === "packages") {
      setLoading(false);
      setLoadError(undefined);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(undefined);
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (section === "users" && query) params.set("query", query);
    if ((section === "runs" || section === "payments") && status) params.set("status", status);
    const path = `/manage/${section}${params.size ? `?${params}` : ""}`;
    api<OverviewData | PageData<ManageUser> | PageData<ManageRun> | PageData<ManagePayment>>(path)
      .then((data) => {
        if (!active) return;
        setForbidden(false);
        setLoadError(undefined);
        if (section === "overview") setOverview(data as OverviewData);
        if (section === "users") setUsers(data as PageData<ManageUser>);
        if (section === "runs") setRuns(data as PageData<ManageRun>);
        if (section === "payments") setPayments(data as PageData<ManagePayment>);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 403) setForbidden(true);
        else {
          const message = error instanceof Error ? error.message : "运营数据加载失败";
          setLoadError(message);
          toast.error(message);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, query, revision, section, status]);

  const activePage = section === "users" ? users : section === "runs" ? runs : payments;
  const pageCount = activePage ? Math.max(1, Math.ceil(activePage.total / activePage.pageSize)) : 1;
  const chartMax = useMemo(
    () => Math.max(1, ...(overview?.trend.map((item) => item.runs) ?? [1])),
    [overview],
  );

  function navigate(next: ManageSection) {
    setSection(next);
    setPage(1);
    setStatus("");
  }

  async function updateUserRole(user: ManageUser, role: "CREATOR" | "MERCHANT") {
    if (user.roles.includes(role)) return;
    setUpdatingRole(user.id);
    try {
      await api(`/manage/users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setUsers((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === user.id ? { ...item, roles: [role] } : item,
              ),
            }
          : current,
      );
      toast.success("用户角色已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "用户角色更新失败");
    } finally {
      setUpdatingRole(undefined);
    }
  }

  if (forbidden)
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0b0b] p-6 text-white">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-400">
            <LogOut size={23} />
          </span>
          <h1 className="mt-5 text-xl font-semibold">暂无运营后台权限</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            当前账号未加入 ADMIN_PHONES 白名单，请联系系统管理员配置。
          </p>
          <Button className="mt-6" onClick={onBack}>
            返回创作台
          </Button>
        </div>
      </main>
    );

  return (
    <div className="flex min-h-screen bg-[#0b0b0b] text-zinc-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-white/[.07] bg-[#101010] md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-white/[.06] px-5">
          <span className="grid size-8 place-items-center rounded-lg bg-white text-[10px] font-black text-black">
            CK
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[.16em] text-white">CREATKEY</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">运营管理后台</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="运营后台导航">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition ${
                section === item.id
                  ? "bg-white text-black"
                  : "text-zinc-500 hover:bg-white/[.05] hover:text-white"
              }`}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/[.06] p-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-zinc-500 hover:bg-white/[.05] hover:text-white"
          >
            <ArrowLeft size={16} /> 返回创作台
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/[.07] bg-[#0b0b0b]/90 px-4 backdrop-blur-xl sm:px-7">
          <div>
            <h1 className="text-sm font-semibold text-white">
              {navItems.find((item) => item.id === section)?.label}
            </h1>
            <p className="mt-0.5 hidden text-[10px] text-zinc-600 sm:block">
              实时掌握平台经营与服务状态
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
              className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-white/[.06] hover:text-white"
              aria-label="刷新数据"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <span className="hidden text-right sm:block">
              <span className="block text-xs text-zinc-300">{admin.displayName}</span>
              <span className="block text-[10px] text-zinc-600">运营管理员</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="grid size-9 place-items-center rounded-full bg-[#262626] text-xs font-medium text-white"
              aria-label="退出登录"
            >
              {admin.displayName.slice(0, 1)}
            </button>
          </div>
        </header>

        <nav
          className="flex gap-1 overflow-x-auto border-b border-white/[.06] p-2 md:hidden"
          aria-label="移动端运营导航"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs ${section === item.id ? "bg-white text-black" : "text-zinc-500"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="mx-auto max-w-[1440px] p-4 sm:p-7">
          {loadError ? (
            <section className="grid h-72 place-items-center rounded-2xl border border-dashed border-white/10 bg-[#121212] px-6 text-center">
              <div>
                <Activity className="mx-auto text-zinc-700" size={24} />
                <h2 className="mt-4 text-sm font-medium text-zinc-300">数据暂时无法加载</h2>
                <p className="mt-2 text-xs text-zinc-600">{loadError}</p>
                <Button
                  className="mt-5"
                  size="sm"
                  variant="secondary"
                  onClick={() => setRevision((value) => value + 1)}
                >
                  <RefreshCw size={14} /> 重新加载
                </Button>
              </div>
            </section>
          ) : section === "packages" ? (
            <RechargePackages />
          ) : loading && !overview && !users && !runs && !payments ? (
            <div className="grid h-80 place-items-center text-zinc-600">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : section === "overview" && overview ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ManageStatCard
                  label="累计用户"
                  value={number.format(overview.metrics.users)}
                  hint={`今日新增 ${overview.metrics.todayUsers} 位`}
                  icon={Users}
                />
                <ManageStatCard
                  label="工作流总数"
                  value={number.format(overview.metrics.workflows)}
                  hint="用户创建的全部工作流"
                  icon={Workflow}
                  tone="violet"
                />
                <ManageStatCard
                  label="执行成功率"
                  value={`${overview.metrics.successRate}%`}
                  hint={`累计执行 ${number.format(overview.metrics.runs)} 次`}
                  icon={Activity}
                  tone="green"
                />
                <ManageStatCard
                  label="累计充值"
                  value={money(overview.metrics.revenueFen)}
                  hint={`${number.format(overview.metrics.paidOrders)} 笔已支付订单`}
                  icon={CircleDollarSign}
                  tone="amber"
                />
              </section>
              <section className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
                <article className="rounded-2xl border border-white/[.07] bg-[#151515] p-5 sm:p-6">
                  <div>
                    <h2 className="text-sm font-medium text-white">近 7 日执行趋势</h2>
                    <p className="mt-1 text-[11px] text-zinc-600">每日工作流执行次数与成功数量</p>
                  </div>
                  <div className="mt-8 flex h-52 items-end gap-3 sm:gap-5">
                    {overview.trend.map((item) => (
                      <div
                        key={item.date}
                        className="flex min-w-0 flex-1 flex-col items-center gap-2"
                      >
                        <div className="flex h-40 w-full items-end justify-center gap-1">
                          <span
                            title={`${item.runs} 次执行`}
                            className="w-3 max-w-[18px] rounded-t bg-blue-500/80 transition-all"
                            style={{ height: `${Math.max(4, (item.runs / chartMax) * 100)}%` }}
                          />
                          <span
                            title={`${item.successfulRuns} 次成功`}
                            className="w-3 max-w-[18px] rounded-t bg-emerald-400/70 transition-all"
                            style={{
                              height: `${Math.max(4, (item.successfulRuns / chartMax) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-600">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-5 border-t border-white/[.06] pt-4 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-2">
                      <i className="size-2 rounded-sm bg-blue-500" />
                      执行次数
                    </span>
                    <span className="flex items-center gap-2">
                      <i className="size-2 rounded-sm bg-emerald-400" />
                      成功次数
                    </span>
                  </div>
                </article>
                <article className="rounded-2xl border border-white/[.07] bg-[#151515] p-5 sm:p-6">
                  <h2 className="text-sm font-medium text-white">近 7 日收入</h2>
                  <p className="mt-1 text-[11px] text-zinc-600">已支付充值订单</p>
                  <div className="mt-5 space-y-3">
                    {overview.trend.map((item) => {
                      const max = Math.max(1, ...overview.trend.map((day) => day.revenueFen));
                      return (
                        <div
                          key={item.date}
                          className="grid grid-cols-[38px_1fr_70px] items-center gap-3 text-[11px]"
                        >
                          <span className="text-zinc-600">{item.label}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-white/[.05]">
                            <i
                              className="block h-full rounded-full bg-amber-400/80"
                              style={{ width: `${(item.revenueFen / max) * 100}%` }}
                            />
                          </span>
                          <span className="text-right text-zinc-400">{money(item.revenueFen)}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </section>
            </>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#151515]">
              <div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-medium text-white">
                    {section === "users"
                      ? "平台用户"
                      : section === "runs"
                        ? "全部运行记录"
                        : "全部充值订单"}
                  </h2>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    共 {number.format(activePage?.total ?? 0)} 条记录
                  </p>
                </div>
                {section === "users" ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      setPage(1);
                      setQuery(search.trim());
                    }}
                    className="relative w-full sm:w-64"
                  >
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                      size={14}
                    />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="搜索昵称或手机号"
                      className="h-9 pl-9"
                    />
                  </form>
                ) : (
                  <select
                    value={status}
                    onChange={(event) => {
                      setPage(1);
                      setStatus(event.target.value);
                    }}
                    className="h-9 rounded-lg border border-white/10 bg-[#1d1d1d] px-3 text-xs text-zinc-300 outline-none"
                  >
                    <option value="">全部状态</option>
                    {(section === "runs"
                      ? ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"]
                      : ["PENDING", "PAID", "CLOSED", "REFUNDED"]
                    ).map((value) => (
                      <option key={value} value={value}>
                        {statusText[value]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-xs">
                  <thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-zinc-600">
                    {section === "users" ? (
                      <tr>
                        <th className="px-5 py-3 font-medium">用户</th>
                        <th className="px-5 py-3 font-medium">角色</th>
                        <th className="px-5 py-3 font-medium">Keys 余额</th>
                        <th className="px-5 py-3 font-medium">业务数据</th>
                        <th className="px-5 py-3 font-medium">注册时间</th>
                        <th className="px-5 py-3 font-medium">操作</th>
                      </tr>
                    ) : section === "runs" ? (
                      <tr>
                        <th className="px-5 py-3 font-medium">工作流</th>
                        <th className="px-5 py-3 font-medium">用户</th>
                        <th className="px-5 py-3 font-medium">状态</th>
                        <th className="px-5 py-3 font-medium">节点 / 消耗</th>
                        <th className="px-5 py-3 font-medium">执行时间</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="px-5 py-3 font-medium">订单号</th>
                        <th className="px-5 py-3 font-medium">用户</th>
                        <th className="px-5 py-3 font-medium">金额 / Keys</th>
                        <th className="px-5 py-3 font-medium">渠道</th>
                        <th className="px-5 py-3 font-medium">状态</th>
                        <th className="px-5 py-3 font-medium">创建时间</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className={loading ? "opacity-50" : ""}>
                    {section === "users" &&
                      users?.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-white/[.055] hover:bg-white/[.018]"
                        >
                          <td className="px-5 py-4">
                            <span className="flex items-center gap-3">
                              <i className="grid size-8 place-items-center rounded-full bg-white/[.07] font-medium text-zinc-300">
                                {item.nickname.slice(0, 1)}
                              </i>
                              <span>
                                <b className="block font-medium text-zinc-200">{item.nickname}</b>
                                <small className="mt-0.5 block text-[10px] text-zinc-600">
                                  {item.phone}
                                </small>
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-4 text-zinc-400">
                            <select
                              value={item.roles.includes("MERCHANT") ? "MERCHANT" : "CREATOR"}
                              disabled={updatingRole === item.id}
                              onChange={(event) =>
                                updateUserRole(item, event.target.value as "CREATOR" | "MERCHANT")
                              }
                              aria-label={`修改 ${item.nickname} 的角色`}
                              className="h-8 rounded-lg border border-white/10 bg-[#1d1d1d] px-2 text-xs text-zinc-300 outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                              <option value="CREATOR">制作人</option>
                              <option value="MERCHANT">商家</option>
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                              <Coins size={13} className="text-amber-400" />
                              {number.format(item.pointAccount?.balance ?? 0)}
                            </span>
                            <small className="mt-1 block text-[10px] text-zinc-600">
                              冻结 {item.pointAccount?.frozen ?? 0}
                            </small>
                          </td>
                          <td className="px-5 py-4 text-zinc-500">
                            工作流 {item._count.workflows} · 执行 {item._count.runs}
                          </td>
                          <td className="px-5 py-4 text-zinc-500">{time(item.createdAt)}</td>
                          <td className="px-5 py-4">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setAdjusting(item)}
                            >
                              调整 Keys
                            </Button>
                          </td>
                        </tr>
                      ))}
                    {section === "runs" &&
                      runs?.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-white/[.055] hover:bg-white/[.018]"
                        >
                          <td className="px-5 py-4">
                            <b className="block max-w-48 truncate font-medium text-zinc-200">
                              {item.workflow.name}
                            </b>
                            <small className="mt-1 block font-mono text-[9px] text-zinc-700">
                              {item.id.slice(0, 8)}
                            </small>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-zinc-300">{item.user.nickname}</span>
                            <small className="mt-1 block text-[10px] text-zinc-600">
                              {item.user.phone}
                            </small>
                          </td>
                          <td className="px-5 py-4">
                            <Badge className={statusClass[item.status]}>
                              {statusText[item.status] ?? item.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-zinc-500">
                            {item._count.nodeRuns} 个节点 · {item.cost} Keys
                          </td>
                          <td className="px-5 py-4 text-zinc-500">{time(item.createdAt)}</td>
                        </tr>
                      ))}
                    {section === "payments" &&
                      payments?.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-white/[.055] hover:bg-white/[.018]"
                        >
                          <td className="px-5 py-4 font-mono text-[10px] text-zinc-400">
                            {item.orderNo}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-zinc-300">{item.user.nickname}</span>
                            <small className="mt-1 block text-[10px] text-zinc-600">
                              {item.user.phone}
                            </small>
                          </td>
                          <td className="px-5 py-4">
                            <b className="font-medium text-zinc-200">{money(item.amountFen)}</b>
                            <small className="mt-1 block text-[10px] text-zinc-600">
                              {item.keys} Keys
                            </small>
                          </td>
                          <td className="px-5 py-4 text-zinc-400">
                            {item.channel === "WECHAT" ? "微信支付" : "支付宝"}
                          </td>
                          <td className="px-5 py-4">
                            <Badge className={statusClass[item.status]}>
                              {statusText[item.status] ?? item.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-zinc-500">{time(item.createdAt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!loading && activePage?.items.length === 0 && (
                  <div className="grid h-40 place-items-center text-xs text-zinc-600">
                    暂无符合条件的数据
                  </div>
                )}
              </div>
              <footer className="flex items-center justify-between border-t border-white/[.07] px-5 py-4 text-[11px] text-zinc-600">
                <span>
                  第 {page} / {pageCount} 页
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((value) => value - 1)}
                    aria-label="上一页"
                  >
                    <ChevronLeft size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={page >= pageCount || loading}
                    onClick={() => setPage((value) => value + 1)}
                    aria-label="下一页"
                  >
                    <ChevronRight size={15} />
                  </Button>
                </div>
              </footer>
            </section>
          )}
        </main>
      </div>
      <PointsAdjustDialog
        user={adjusting}
        onClose={() => setAdjusting(undefined)}
        onSuccess={() => setRevision((value) => value + 1)}
      />
    </div>
  );
}
