import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import AlertBanner from "../components/AlertBanner";
import StatCard from "../components/StatCard";
import { api } from "../lib/api";

const PIE_COLORS = [
  "url(#pie-dot-yellow)",
  "url(#pie-solid-coral)",
  "url(#pie-solid-slate)",
  "url(#pie-line-teal)",
  "url(#pie-dot-yellow)",
  "url(#pie-solid-coral)",
  "url(#pie-solid-slate)",
  "url(#pie-line-teal)",
  "url(#pie-dot-yellow)",
  "url(#pie-solid-coral)"
];

const BAR_COLORS = [
  "url(#bar-solid-slate)",
  "url(#bar-line-teal)",
  "url(#bar-solid-coral)"
];

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState(null);
  const [report, setReport] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const load = async () => {
      const [summaryResp, reportResp, budgetsResp] = await Promise.all([
        api.get(`/dashboard/summary/?year=${year}&month=${month}`),
        api.get(`/reports/monthly/?year=${year}&month=${month}`),
        api.get(`/budgets/?year=${year}&month=${month}`)
      ]);
      setSummary(summaryResp.data);
      setReport(reportResp.data);

      const budget = budgetsResp.data?.results?.find((b) => b.year === year && b.month === month);
      if (budget) {
        const alertResp = await api.get(`/budgets/${budget.id}/alerts/`);
        setAlerts(alertResp.data.alerts || []);
      } else {
        setAlerts([]);
      }
    };

    load().catch(() => setSummary(null));
  }, [year, month]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const pieData = useMemo(
    () =>
      (report?.category_breakdown || []).map((x) => ({
        name: x.category__name || "Uncategorized",
        value: Number(x.total)
      })),
    [report]
  );

  const barData = useMemo(
    () => [
      { name: "Income", amount: Number(summary?.total_income || 0) },
      { name: "Expense", amount: Number(summary?.total_expense || 0) },
      { name: "Savings", amount: Number(summary?.savings || 0) }
    ],
    [summary]
  );


  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h2 className="mr-auto font-heading text-xl font-extrabold sm:text-2xl">Dashboard Analytics</h2>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-[48%] rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 sm:w-28"
        />
        <input
          type="number"
          min={1}
          max={12}
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="w-[48%] rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 sm:w-24"
        />
      </div>

      <AlertBanner alerts={alerts} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Total Income" value={summary?.total_income ?? "0.00"} accent="mint" />
        <StatCard title="Total Expense" value={summary?.total_expense ?? "0.00"} accent="coral" />
        <StatCard title="Savings" value={summary?.savings ?? "0.00"} accent="slate" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Category expense pie chart</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <defs>
                  <pattern id="pie-dot-yellow" patternUnits="userSpaceOnUse" width="8" height="8">
                    <rect width="8" height="8" fill="#F2C811" />
                    <circle cx="2" cy="2" r="1.2" fill="#D9B008" />
                    <circle cx="6" cy="6" r="1.2" fill="#D9B008" />
                  </pattern>
                  <pattern id="pie-line-teal" patternUnits="userSpaceOnUse" width="8" height="8">
                    <rect width="8" height="8" fill="#18B7AE" />
                    <path d="M0 8L8 0" stroke="#0C8E86" strokeWidth="1.2" />
                  </pattern>
                  <pattern id="pie-solid-coral" patternUnits="userSpaceOnUse" width="8" height="8">
                    <rect width="8" height="8" fill="#F56565" />
                  </pattern>
                  <pattern id="pie-solid-slate" patternUnits="userSpaceOnUse" width="8" height="8">
                    <rect width="8" height="8" fill="#3F4C56" />
                  </pattern>
                </defs>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={isMobile ? 72 : 90}
                  stroke="#F8FAFC"
                  strokeWidth={1.5}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                {!isMobile && <Legend />}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Monthly comparison bar chart</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={barData} barCategoryGap="28%">
                <defs>
                  <pattern id="bar-solid-slate" patternUnits="userSpaceOnUse" width="10" height="10">
                    <rect width="10" height="10" fill="#3F4C56" />
                  </pattern>
                  <pattern id="bar-line-teal" patternUnits="userSpaceOnUse" width="10" height="10">
                    <rect width="10" height="10" fill="#18B7AE" />
                    <path d="M0 10L10 0" stroke="#0C8E86" strokeWidth="1.3" />
                  </pattern>
                  <pattern id="bar-solid-coral" patternUnits="userSpaceOnUse" width="10" height="10">
                    <rect width="10" height="10" fill="#F56565" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: isMobile ? 11 : 12 }} />
                <YAxis tick={{ fontSize: isMobile ? 11 : 12 }} />
                <Tooltip />
                <Bar
                  dataKey="amount"
                  barSize={isMobile ? 24 : 34}
                  maxBarSize={isMobile ? 24 : 34}
                  radius={[4, 4, 0, 0]}
                >
                  {barData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Recent transactions</h3>
          <div className="space-y-2">
            {(summary?.recent_transactions || []).map((tx) => (
              <div key={tx.id} className="rounded-lg bg-slate-100/70 px-3 py-2 text-sm dark:bg-slate-800">
                <p className="font-semibold">
                  {tx.txn_type} - {tx.amount}
                </p>
                <p className="text-xs text-slate-500">{tx.category_name || "Uncategorized"}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">Top spending categories</h3>
          <div className="space-y-2">
            {(summary?.top_spending_categories || []).map((row, idx) => (
              <div
                key={`${row.category__name}-${idx}`}
                className="flex items-start justify-between gap-2 rounded-lg bg-slate-100/70 px-3 py-2 text-sm dark:bg-slate-800"
              >
                <span>{row.category__name || "Uncategorized"}</span>
                <span className="font-bold">{row.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
