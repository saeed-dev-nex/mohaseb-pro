import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { dashboardAPI, invoicesAPI } from "../services/api";
import {
  Button,
  Card,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
  formatPrice,
} from "../components/ui";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  BarChartIcon,
  CheckCircleIcon,
  ClipboardIcon,
  CogIcon,
  CrownIcon,
  FileTextIcon,
  HardHatIcon,
  HourglassIcon,
  PlusIcon,
  SlidersIcon,
  TicketIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "../components/icons";
import { Link } from "react-router-dom";
import { toJalali } from "../utils/persian";

const fmt = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("fa-IR").format(Number(n) || 0);

type MonthData = {
  month?: string;
  label?: string;
  revenue?: number;
  expense?: number;
  profit?: number;
};

type TopServiceItem = {
  service_title_snapshot?: string | null;
  total: number;
  count: number;
};

type OverdueItem = {
  id: number;
  invoice_number: string;
  customer_name: string;
  due_date: string;
  remaining_amount: number;
};

type TopCustomer = {
  customer__name?: string | null;
  total: number;
  count: number;
};

type RecentInvoice = {
  id: number;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
};

type UpcomingCheque = {
  id: number;
  type: string;
  bank_name: string;
  customer_name: string;
  cheque_number: string;
  amount: number;
  due_date: string;
};

type DashboardStats = {
  total_customers: number;
  total_invoices: number;
  total_commission: number;
  pending_invoices: number;
  paid_invoices: number;
  total_expenses: number;
  net_profit: number;
  overdue_invoices: number;
  overdue_amount?: number;
  overdue_items?: OverdueItem[];
  monthly_revenue?: MonthData[];
  top_services?: TopServiceItem[];
  top_customers?: TopCustomer[];
  recent_invoices?: RecentInvoice[];
  upcoming_cheques?: UpcomingCheque[];
};

type ReminderInvoice = {
  id: number;
  invoice_number: string;
  customer_name: string;
  days: number;
  due_date: string;
  remaining_amount: number;
};

type ReminderCheque = {
  id: number;
  cheque_number: string;
  bank_name: string;
  customer_name: string;
  days: number;
  due_date: string;
  amount: number;
};

type DashboardReminders = {
  totals: {
    due_soon_invoices_count: number;
    cheques_due_count: number;
    bounced_cheques_count: number;
    bounced_cheques_amount: number;
  };
  due_soon_invoices: ReminderInvoice[];
  cheques_due: ReminderCheque[];
};

// ── Mini Bar Chart (revenue vs expense) ──
const BarChart = ({ data }: { data: MonthData[] }) => {
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.revenue || 0, d.expense || 0)),
    1,
  );
  const compactAmount = (value: number) =>
    new Intl.NumberFormat("fa-IR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value || 0);
  const monthLabel = (month: MonthData) => {
    // The API buckets by Jalali month and sends its Persian label
    // (e.g. «آبان ۱۴۰۵») — it is authoritative; the Intl path below is
    // only a fallback for payloads without a label.
    if (month.label) return month.label;
    const [year, number] = (month.month || "").split("-").map(Number);
    if (!year || !number) return month.label;
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      month: "short",
    }).format(new Date(year, number - 1, 15));
  };
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between pointer-events-none">
        {[1, 0.66, 0.33, 0].map((tick, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="num w-12 shrink-0 text-left text-[10px] text-slate-500">
              {compactAmount(maxVal * tick)}
            </span>
            <span className="h-px flex-1 border-t border-dashed border-slate-700/70" />
          </div>
        ))}
      </div>
      {/* RTL: the axis labels sit on the right, so reserve space on that side. */}
      <div className="relative flex items-end gap-3 h-48 pr-14 pb-7">
        {data.map((month, i) => {
          const revPct = Math.max(((month.revenue || 0) / maxVal) * 100, 2);
          const expPct = Math.max(((month.expense || 0) / maxVal) * 100, 2);
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-2 group"
            >
              <div
                className="relative w-full flex items-end gap-1"
                style={{ height: "170px" }}
              >
                {/* Tooltip */}
                <div
                  className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity
                bg-slate-700 text-white text-[10px] rounded-lg px-2 py-1.5 whitespace-nowrap z-10 pointer-events-none leading-relaxed"
                >
                  <span className="text-blue-300">
                    درآمد: {fmt(month.revenue)}
                  </span>
                  <br />
                  <span className="text-red-300">
                    هزینه: {fmt(month.expense)}
                  </span>
                  <br />
                  <span className="text-green-300">
                    سود: {fmt(month.profit)}
                  </span>
                </div>
                {/* Revenue bar */}
                <div
                  title={`درآمد ${fmt(month.revenue)}`}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-blue-600 to-indigo-400 group-hover:from-indigo-600 group-hover:to-blue-300 transition-all duration-300"
                  style={{ height: `${revPct}%` }}
                />
                {/* Expense bar */}
                <div
                  title={`هزینه ${fmt(month.expense)}`}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-red-600/60 to-red-400/60 group-hover:from-red-500 group-hover:to-red-300 transition-all duration-300"
                  style={{ height: `${expPct}%` }}
                />
              </div>
              <span className="text-slate-400 text-xs">
                {monthLabel(month)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Pie Chart (CSS-only donut) ──
const DonutChart = ({
  data,
  total,
}: {
  data: TopServiceItem[];
  total: number;
}) => {
  const colors = [
    "#6366f1",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];
  let cumPct = 0;
  const segments = data.map((item, i) => {
    const pct = total > 0 ? (item.total / total) * 100 : 0;
    const start = cumPct;
    cumPct += pct;
    return { ...item, pct, start, color: colors[i % colors.length] };
  });

  const gradient =
    segments.length > 0
      ? `conic-gradient(${segments.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ")})`
      : "conic-gradient(#334155 0% 100%)";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-36 h-36">
        <div
          className="w-full h-full rounded-full"
          style={{ background: gradient }}
        />
        <div className="absolute inset-3 rounded-full bg-slate-900 flex items-center justify-center flex-col">
          <span className="num text-white font-bold text-sm">
            {segments.length}
          </span>
          <span className="text-slate-500 text-[10px]">خدمت</span>
        </div>
      </div>
      <div className="space-y-1.5 w-full">
        {segments.slice(0, 5).map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-slate-300 truncate">
                {s.service_title_snapshot || "---"}
              </span>
            </div>
            <span className="num text-slate-400 shrink-0">
              {s.count} بار
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// One row in the «نیازمند اقدام» panel.
type ActionItem = {
  key: string;
  to: string;
  title: string;
  meta: string;
  amount: string;
  tone: "danger" | "warning" | "info";
};

const ACTION_TONE = {
  danger: { dot: "bg-red-400", text: "text-red-400" },
  warning: { dot: "bg-amber-400", text: "text-amber-300" },
  info: { dot: "bg-sky-400", text: "text-sky-300" },
} as const;

// Layout-shaped placeholder so the dashboard does not jump on load.
const DashboardSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="در حال بارگذاری داشبورد">
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5"
        >
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-7 w-28" />
        </div>
      ))}
    </div>
    <div className="grid gap-6 xl:grid-cols-3">
      <Skeleton className="h-56 rounded-2xl xl:col-span-2" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
    <div className="grid gap-6 xl:grid-cols-3">
      <Skeleton className="h-64 rounded-2xl xl:col-span-2" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reminders, setReminders] = useState<DashboardReminders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const currentUser = useSelector((s: any) => s.auth.currentUser);

  const load = React.useCallback(() => {
    dashboardAPI
      .stats()
      .then((res) => {
        // Guard against non-JSON payloads (e.g. an SPA fallback page) so a
        // misrouted request shows the error state instead of crashing.
        if (res?.data && typeof res.data === "object") {
          setStats(res.data);
          setError(false);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    dashboardAPI
      .reminders(7)
      .then((res) => {
        if (res?.data && typeof res.data === "object") setReminders(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("mohaseb:data-changed", load);
    return () => window.removeEventListener("mohaseb:data-changed", load);
  }, [load]);

  const handleMarkPaid = async (id: number) => {
    await invoicesAPI.markPaid(id);
    const res = await dashboardAPI.stats();
    setStats(res.data);
  };

  // A greeting and the Jalali date give the page a human "today" anchor
  // instead of a bare section title.
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "صبح بخیر" : hour < 17 ? "ظهر بخیر" : "عصر بخیر";
  const firstName = currentUser?.first_name || currentUser?.username || "";
  const today = new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const header = (
    <PageHeader
      title="داشبورد"
      description={`${greet}${firstName ? `، ${firstName}` : ""} · ${today}`}
      actions={
        <Link to="/invoices/new">
          <Button variant="primary">
            <PlusIcon className="h-4 w-4" />
            فاکتور جدید
          </Button>
        </Link>
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <DashboardSkeleton />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState onRetry={load} />
      </div>
    );
  }

  const topSvcTotal = (stats?.top_services || []).reduce(
    (a, s) => a + Number(s.total || 0),
    0,
  );

  const commission = Number(stats?.total_commission || 0);
  const expenses = Number(stats?.total_expenses || 0);
  const netProfit = Number(stats?.net_profit || 0);
  const profitPositive = netProfit >= 0;
  const spendBase = commission + expenses;
  const commissionPct =
    spendBase > 0 ? (commission / spendBase) * 100 : 50;
  const expensePct = 100 - commissionPct;
  const margin =
    commission > 0 ? Math.round((netProfit / commission) * 100) : 0;

  // Everything that wants the user's attention today, in one place and in
  // priority order: overdue first, then due soon, then cheques.
  const actionItems: ActionItem[] = [
    ...(stats?.overdue_items || []).map((item) => ({
      key: `overdue-${item.id}`,
      to: `/invoices/${item.id}`,
      title: `فاکتور ${item.invoice_number} · ${item.customer_name}`,
      meta: `سررسید گذشته · ${toJalali(item.due_date)}`,
      amount: formatPrice(item.remaining_amount),
      tone: "danger" as const,
    })),
    ...(reminders?.due_soon_invoices || []).slice(0, 5).map((item) => ({
      key: `due-${item.id}`,
      to: `/invoices/${item.id}`,
      title: `فاکتور ${item.invoice_number} · ${item.customer_name}`,
      meta: `${fmt(item.days)} روز مانده · ${toJalali(item.due_date)}`,
      amount: formatPrice(item.remaining_amount),
      tone: "warning" as const,
    })),
    ...(reminders?.cheques_due || []).slice(0, 5).map((item) => ({
      key: `cheque-${item.id}`,
      to: "/cheques",
      title: `چک ${item.cheque_number} · ${item.bank_name} · ${item.customer_name}`,
      meta: `${fmt(item.days)} روز مانده · ${toJalali(item.due_date)}`,
      amount: formatPrice(item.amount),
      tone: "info" as const,
    })),
  ];
  const bouncedCount = reminders?.totals?.bounced_cheques_count || 0;
  const bouncedAmount = reminders?.totals?.bounced_cheques_amount || 0;
  const shownActions = actionItems.slice(0, 8);
  const moreActions = actionItems.length - shownActions.length;
  const attentionTotal = actionItems.length + bouncedCount;

  const financials = [
    {
      label: "کارمزد (درآمد)",
      value: formatPrice(commission),
      icon: <TrendingUpIcon className="h-4 w-4" />,
      tone: "text-emerald-400",
    },
    {
      label: "کل هزینه‌ها",
      value: formatPrice(expenses),
      icon: <BanknoteIcon className="h-4 w-4" />,
      tone: "text-rose-400",
    },
    {
      label: "سود خالص",
      value: formatPrice(netProfit),
      icon: profitPositive ? (
        <TrendingUpIcon className="h-4 w-4" />
      ) : (
        <TrendingDownIcon className="h-4 w-4" />
      ),
      tone: profitPositive ? "text-emerald-400" : "text-rose-400",
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {/* Primary KPIs — one row, one job: how is the business doing. */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="کل فاکتورها"
          value={fmt(stats?.total_invoices || 0)}
          icon={<FileTextIcon />}
          color="purple"
          sub={`پرداخت‌شده: ${fmt(stats?.paid_invoices || 0)}`}
        />
        <StatCard
          label="در انتظار پرداخت"
          value={fmt(stats?.pending_invoices || 0)}
          icon={<HourglassIcon />}
          color="yellow"
        />
        <StatCard
          label="فاکتورهای معوق"
          value={fmt(stats?.overdue_invoices || 0)}
          icon={<AlertTriangleIcon />}
          color="red"
          sub={`مانده: ${formatPrice(stats?.overdue_amount || 0)}`}
        />
        <StatCard
          label="کل مشتریان"
          value={fmt(stats?.total_customers || 0)}
          icon={<UsersIcon />}
          color="blue"
        />
      </div>

      {/* Money in / money out, next to what needs attention. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="خلاصهٔ مالی"
          icon={<WalletIcon />}
          actions={
            <Link
              to="/reports"
              className="text-xs text-blue-400 transition-colors hover:text-blue-300"
            >
              گزارش کامل ←
            </Link>
          }
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            {financials.map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-slate-700/30 p-3.5"
              >
                <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className={item.tone}>{item.icon}</span>
                  {item.label}
                </dt>
                <dd className={`num mt-1.5 text-lg font-bold ${item.tone}`}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          {spendBase > 0 && (
            <div className="mt-5">
              <div
                className="flex h-2 overflow-hidden rounded-full bg-slate-700/40"
                role="img"
                aria-label={`سهم کارمزد ${fmt(Math.round(commissionPct))} درصد، سهم هزینه ${fmt(Math.round(expensePct))} درصد`}
              >
                <span
                  className="h-full bg-emerald-500/80"
                  style={{ width: `${commissionPct}%` }}
                />
                <span
                  className="h-full bg-rose-500/70"
                  style={{ width: `${expensePct}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-emerald-500/80" />
                  کارمزد {fmt(Math.round(commissionPct))}٪
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-rose-500/70" />
                  هزینه {fmt(Math.round(expensePct))}٪
                </span>
                <span>
                  حاشیهٔ سود:{" "}
                  <span className={profitPositive ? "text-emerald-400" : "text-rose-400"}>
                    {fmt(margin)}٪
                  </span>
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="نیازمند اقدام"
          icon={<AlertTriangleIcon className="!text-amber-400" />}
          actions={
            attentionTotal > 0 ? (
              <span className="num rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {fmt(attentionTotal)} مورد
              </span>
            ) : undefined
          }
          bodyClassName="max-h-[26rem] overflow-y-auto -mx-2 px-2"
        >
          {bouncedCount > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              <span>
                {fmt(bouncedCount)} چک برگشتی نیازمند پیگیری (
                {formatPrice(bouncedAmount)})
              </span>
            </div>
          )}

          {shownActions.length === 0 && bouncedCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 [&>svg]:h-5 [&>svg]:w-5">
                <CheckCircleIcon />
              </span>
              <p className="text-sm font-medium text-slate-200">
                همه‌چیز مرتب است
              </p>
              <p className="mt-1 text-xs text-slate-500">
                فاکتور یا چک سررسید‌شده‌ای برای پیگیری ندارید
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700/40">
              {shownActions.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    className="group flex items-center gap-3 py-2.5"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${ACTION_TONE[item.tone].dot}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-200 group-hover:text-white transition-colors">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {item.meta}
                      </span>
                    </span>
                    <span
                      className={`num shrink-0 text-sm font-semibold ${ACTION_TONE[item.tone].text}`}
                    >
                      {item.amount}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {(moreActions > 0 || actionItems.length > 0) && (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-700/40 pt-3 text-xs">
              <Link
                to="/reports"
                className="text-blue-400 transition-colors hover:text-blue-300"
              >
                همهٔ معوقات
              </Link>
              {moreActions > 0 && (
                <Link
                  to="/cheques"
                  className="text-slate-500 transition-colors hover:text-slate-300"
                >
                  {fmt(moreActions)} مورد دیگر
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="درآمد و هزینه ۶ ماه گذشته"
          actions={
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                درآمد
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400/70" />
                هزینه
              </span>
            </div>
          }
        >
          {stats?.monthly_revenue ? (
            <BarChart data={stats.monthly_revenue} />
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
              داده‌ای موجود نیست
            </div>
          )}
        </Card>

        <Card
          title="بیشترین خدمات"
          icon={<CogIcon />}
        >
          {(stats?.top_services || []).length > 0 ? (
            <DonutChart data={stats.top_services} total={topSvcTotal} />
          ) : (
            <div className="flex items-center justify-center text-slate-500 text-sm h-48">
              داده‌ای موجود نیست
            </div>
          )}
        </Card>
      </div>

      {/* Top Customers + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          title="بهترین مشتریان"
          icon={<CrownIcon className="!text-amber-400/80" />}
          className="min-w-0 overflow-hidden"
        >
          {(stats?.top_customers || []).length > 0 ? (
            <div className="space-y-2">
              {stats.top_customers.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 min-w-0 bg-slate-700/30 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`num w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold
                      ${i === 0 ? "bg-yellow-500/20 text-yellow-400" : i === 1 ? "bg-slate-400/20 text-slate-300" : "bg-orange-500/20 text-orange-400"}`}
                    >
                      {fmt(i + 1)}
                    </span>
                    <span className="text-white text-sm font-medium truncate min-w-0">
                      {c.customer__name || "---"}
                    </span>
                  </div>
                  <div className="text-left shrink-0 whitespace-nowrap">
                    <p className="num text-blue-400 font-semibold text-sm">
                      {formatPrice(c.total)}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {fmt(c.count)} فاکتور
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm text-center py-8">
              داده‌ای موجود نیست
            </div>
          )}
        </Card>

        {/* Shortcuts are secondary: one neutral tile style, accent on hover. */}
        <Card title="دسترسی سریع">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { to: "/invoices/new", icon: <PlusIcon />, label: "صدور فاکتور" },
              { to: "/customers", icon: <UserIcon />, label: "مشتریان" },
              { to: "/services", icon: <CogIcon />, label: "خدمات" },
              { to: "/expenses", icon: <WalletIcon />, label: "هزینه‌ها" },
              { to: "/staff", icon: <HardHatIcon />, label: "پرسنل" },
              { to: "/reports", icon: <BarChartIcon />, label: "گزارشات" },
              { to: "/settings", icon: <SlidersIcon />, label: "تنظیمات برند" },
              {
                to: "/invoices?status=pending",
                icon: <ClipboardIcon />,
                label: "فاکتورهای معلق",
              },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-700/20 p-3 text-sm text-slate-200 transition-colors hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white"
              >
                <span className="shrink-0 text-slate-400 [&>svg]:h-5 [&>svg]:w-5">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Invoices + Upcoming Cheques */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="آخرین فاکتورها"
          className="min-w-0 overflow-hidden"
          actions={
            <Link
              to="/invoices"
              className="text-xs text-blue-400 transition-colors hover:text-blue-300"
            >
              مشاهده همه ←
            </Link>
          }
        >
          {stats?.recent_invoices?.length > 0 ? (
            <div className="space-y-2">
              {stats.recent_invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 min-w-0 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-all group"
                >
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    <span className="text-blue-400 font-mono text-xs bg-blue-500/10 px-2 py-1 rounded-lg shrink-0 whitespace-nowrap">
                      {inv.invoice_number}
                    </span>
                    <span className="text-slate-200 text-sm truncate min-w-0">
                      {inv.customer_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <span className="num text-slate-300 text-sm font-medium whitespace-nowrap">
                      {formatPrice(inv.total_amount)}
                    </span>
                    <StatusBadge status={inv.status} />
                    <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity hidden sm:flex gap-1">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-xs px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-all"
                      >
                        مشاهده
                      </Link>
                      {inv.status === "pending" && (
                        <button
                          onClick={() => handleMarkPaid(inv.id)}
                          className="text-xs px-2 py-1 rounded-lg text-green-400 hover:bg-green-500/10 transition-all"
                        >
                          پرداخت
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">
              هنوز فاکتوری ثبت نشده است
            </p>
          )}
        </Card>

        <Card
          title="چک‌های سررسید نزدیک (۱۰ روز آینده)"
          icon={<TicketIcon />}
          className="min-w-0 overflow-hidden"
          actions={
            <Link
              to="/cheques"
              className="text-xs text-blue-400 transition-colors hover:text-blue-300"
            >
              مشاهده همه ←
            </Link>
          }
        >
          {stats?.upcoming_cheques?.length > 0 ? (
            <div className="space-y-2">
              {stats.upcoming_cheques.map((chq) => (
                <div
                  key={chq.id}
                  className="flex items-center justify-between gap-2 min-w-0 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-all group"
                >
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    <span
                      className={`text-xs px-2 py-1 rounded-lg font-medium border shrink-0 whitespace-nowrap ${
                        chq.type === "incoming"
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          : "bg-purple-500/10 border-purple-500/20 text-purple-400"
                      }`}
                    >
                      {chq.type === "incoming" ? "دریافتی" : "پرداختی"}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-slate-200 text-sm font-medium truncate">
                        {chq.bank_name} ({chq.customer_name})
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5 font-mono truncate">
                        شماره چک: {chq.cheque_number}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <span className="num text-slate-300 text-sm font-medium whitespace-nowrap">
                      {formatPrice(chq.amount)}
                    </span>
                    <span className="num text-xs text-yellow-400 font-mono bg-yellow-500/10 px-2 py-1 rounded-lg">
                      {toJalali(chq.due_date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">
              چک سررسید نزدیک در ۱۰ روز آینده وجود ندارد
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
