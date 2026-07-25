import { useState } from "react";
import { api, downloadWithAuth } from "../lib/api";

function CsvIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M8 12h8M8 16h8" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M8 14h2a1.5 1.5 0 0 0 0-3H8v6" />
      <path d="M13 17h1.5a2 2 0 0 0 0-4H13v4Z" />
      <path d="M18 11h-2v6" />
    </svg>
  );
}

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);

  const loadReport = async () => {
    const resp = await api.get(`/reports/monthly/?year=${year}&month=${month}`);
    setReport(resp.data);
  };

  const exportCsv = async () => {
    await downloadWithAuth(`/reports/export/csv/?year=${year}&month=${month}`, "transactions.csv", "text/csv");
  };

  const exportPdf = async () => {
    await downloadWithAuth(
      `/reports/export/pdf/?year=${year}&month=${month}`,
      "monthly_report.pdf",
      "application/pdf"
    );
  };

  return (
    <section className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading text-xl font-extrabold sm:text-2xl text-slate-800 dark:text-slate-100">Reports & Export</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Generate monthly performance reports, download ledger sheets, and export CSV/PDF summaries</p>
      </div>

      <div className="rounded-2xl glass-panel p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            placeholder="Year"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            placeholder="Month"
          />
          <button
            onClick={loadReport}
            className="w-full rounded-xl bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white font-bold text-sm px-8 py-2.5 shadow-md shadow-[#29d1c4]/20 hover:shadow-glow-teal active:scale-95 transition-all duration-300 md:w-auto"
          >
            Load report
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={exportCsv}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/60 dark:bg-slate-950/40 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-905 px-4 py-3 text-sm font-semibold transition-all duration-300 active:scale-98"
          >
            <CsvIcon />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportPdf}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/60 dark:bg-slate-950/40 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-905 px-4 py-3 text-sm font-semibold transition-all duration-300 active:scale-98"
          >
            <PdfIcon />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {report && (
        <div className="rounded-2xl glass-panel p-5 animate-fade-in-up">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Report Details</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 px-4 py-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Income</span>
              <p className="text-lg font-extrabold text-mint mt-1">₹{report.total_income}</p>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 px-4 py-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Expense</span>
              <p className="text-lg font-extrabold text-coral mt-1">₹{report.total_expense}</p>
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 px-4 py-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Net Savings</span>
              <p className="text-lg font-extrabold text-[#1da79b] mt-1">₹{report.savings}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
