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
    <section className="space-y-5">
      <h2 className="font-heading text-xl font-extrabold sm:text-2xl">Monthly Reports & Export</h2>
      <div className="mt-4 rounded-3xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70 sm:p-6 md:p-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            onClick={loadReport}
            className="w-full rounded-xl bg-ink px-8 py-3 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-900 md:w-auto"
          >
            Load report
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={exportCsv}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-400 bg-white px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <CsvIcon />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportPdf}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-400 bg-white px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <PdfIcon />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {report && (
        <div className="rounded-2xl bg-white/70 p-5 shadow-soft dark:bg-slate-900/70">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <p className="rounded-lg bg-slate-100/80 px-3 py-2 text-sm dark:bg-slate-800">
              Income: <span className="font-semibold">{report.total_income}</span>
            </p>
            <p className="rounded-lg bg-slate-100/80 px-3 py-2 text-sm dark:bg-slate-800">
              Expense: <span className="font-semibold">{report.total_expense}</span>
            </p>
            <p className="rounded-lg bg-slate-100/80 px-3 py-2 text-sm dark:bg-slate-800">
              Savings: <span className="font-semibold">{report.savings}</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
