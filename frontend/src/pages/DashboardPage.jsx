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
import { Link } from "react-router-dom";
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
  const [activeBudget, setActiveBudget] = useState(null);
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
      setActiveBudget(budget || null);
      if (budget) {
        const alertResp = await api.get(`/budgets/${budget.id}/alerts/`);
        setAlerts(alertResp.data.alerts || []);
      } else {
        setAlerts([]);
      }
    };

    load().catch(() => {
      setSummary(null);
      setActiveBudget(null);
    });
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


  const { budgetPercent, strokeDashoffset, circumference, radius, ringColor } = useMemo(() => {
    const limit = Number(activeBudget?.limit || 0);
    const spent = Number(summary?.total_expense || 0);
    const percent = limit > 0 ? (spent / limit) * 100 : 0;
    
    const r = 26;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(percent, 100) / 100) * circ;
    
    let color = "#29d1c4";
    if (percent >= 100) color = "#ff6b4a";
    else if (percent >= 75) color = "#f97316";
    
    return {
      budgetPercent: percent,
      strokeDashoffset: offset,
      circumference: circ,
      radius: r,
      ringColor: color
    };
  }, [activeBudget, summary]);

  const netWorth = useMemo(() => {
    if (!summary?.account_balances) return 0;
    return summary.account_balances.reduce((acc, curr) => acc + Number(curr.current_balance || 0), 0);
  }, [summary]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/20 dark:border-slate-800/15 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h2 className="font-heading text-xl font-extrabold sm:text-2xl text-slate-800 dark:text-slate-100">Dashboard Analytics</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Real-time overview of your finances</p>
          </div>
          
          {/* Net Wallet Balance Pill */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#29d1c4]/10 to-[#1da79b]/10 dark:from-[#29d1c4]/5 dark:to-[#1da79b]/5 border border-[#29d1c4]/20 rounded-2xl px-4 py-1.5 shadow-sm select-none">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Net Balance</span>
              <span className="font-heading text-sm font-black text-[#29d1c4]">
                ₹{netWorth.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4.5 w-4.5 text-[#29d1c4] opacity-80">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto w-full sm:w-auto mt-2 sm:mt-0">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-1/2 sm:w-28 rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            placeholder="Year"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-1/2 sm:w-24 rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            placeholder="Month"
          />
        </div>
      </div>

      <AlertBanner alerts={alerts} />

      <div id="tour-stats" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Income" value={summary ? '₹' + (summary.total_income ?? "0.00") : '₹0.00'} accent="mint" />
        <StatCard title="Total Expense" value={summary ? '₹' + (summary.total_expense ?? "0.00") : '₹0.00'} accent="coral" />
        <StatCard title="Savings" value={summary ? '₹' + (summary.savings ?? "0.00") : '₹0.00'} accent="slate" />
        
        {/* Animated Budget Ring Card */}
        <div className="rounded-2xl glass-panel p-5 flex items-center justify-between min-h-[96px] relative overflow-hidden bg-white/40 dark:bg-slate-900/30">
          <div className="flex-1 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Budget Progress
            </p>
            {activeBudget ? (
              <div className="space-y-0.5">
                <p className="font-heading text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
                  {Math.round(budgetPercent)}%
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  ₹{Math.round(Number(summary?.total_expense || 0)).toLocaleString("en-IN")} / ₹{Math.round(Number(activeBudget.limit)).toLocaleString("en-IN")}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-650 dark:text-slate-400">Not configured</p>
                <Link to="/budgets" className="text-[9px] text-[#29d1c4] font-extrabold hover:underline">Setup Budget ➔</Link>
              </div>
            )}
          </div>
          
          {activeBudget && (
            <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  className="stroke-slate-200/60 dark:stroke-slate-800/60"
                  strokeWidth="3.5"
                  fill="none"
                />
                {/* Foreground Progress Ring */}
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke={ringColor}
                  strokeWidth="3.5"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-in-out"
                />
              </svg>
              {/* Center Status indicator */}
              <div className="absolute inset-0 flex items-center justify-center">
                {budgetPercent >= 100 ? (
                  <span className="text-xs select-none">⚠️</span>
                ) : (
                  <span className="text-[9px] text-slate-400 font-bold uppercase select-none">Limit</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div id="tour-charts" className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-2xl glass-panel p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Expense Distribution</h3>
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

        <div className="rounded-2xl glass-panel p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Flow Comparison</h3>
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div id="tour-recent" className="rounded-2xl glass-panel p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Recent Transactions</h3>
          <div className="space-y-3">
            {(summary?.recent_transactions || []).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 px-4 py-3 hover:-translate-y-0.5 transition-all duration-300">
                <div>
                  <p className="text-xs font-semibold capitalize text-slate-800 dark:text-slate-200">{tx.category_name || "Uncategorized"}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{tx.date}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.txn_type === "income" ? "text-mint" : "text-coral"}`}>
                    {tx.txn_type === "income" ? "+" : "-"}₹{tx.amount}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize mt-0.5">{tx.account_name || "No Wallet"}</p>
                </div>
              </div>
            ))}
            {(!summary?.recent_transactions || summary.recent_transactions.length === 0) && (
              <p className="text-sm text-slate-400 py-6 text-center">No recent transactions</p>
            )}
          </div>
        </div>

        <div id="tour-top-spending" className="rounded-2xl glass-panel p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Top Spending Categories</h3>
          <div className="space-y-3">
            {(summary?.top_spending_categories || []).map((row, idx) => (
              <div
                key={`${row.category__name}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 px-4 py-3 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-coral animate-pulse" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{row.category__name || "Uncategorized"}</span>
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">₹{row.total}</span>
              </div>
            ))}
            {(!summary?.top_spending_categories || summary.top_spending_categories.length === 0) && (
              <p className="text-sm text-slate-400 py-6 text-center">No category spending data yet</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
