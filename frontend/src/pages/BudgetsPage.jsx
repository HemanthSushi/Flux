import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function BudgetsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [totalBudget, setTotalBudget] = useState("");
  const [budgetId, setBudgetId] = useState(null);
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [budgetsResp, catResp] = await Promise.all([
      api.get(`/budgets/?year=${year}&month=${month}`),
      api.get("/categories/?txn_type=expense")
    ]);
    const allBudgets = budgetsResp.data.results || [];
    const existing = allBudgets.find((b) => b.year === Number(year) && b.month === Number(month));
    setCategories(catResp.data.results || catResp.data);
    if (existing) {
      setBudgetId(existing.id);
      setTotalBudget(existing.total_budget);
      setRows(existing.category_budgets || []);
    } else {
      setBudgetId(null);
      setTotalBudget("");
      setRows([]);
    }
  };

  useEffect(() => {
    load().catch(() => setRows([]));
  }, [year, month]);

  const addRow = () => setRows((prev) => [...prev, { category: "", limit_amount: "" }]);

  const updateRow = (index, key, value) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)));

  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      year: Number(year),
      month: Number(month),
      total_budget: totalBudget,
      category_budgets: rows.filter((r) => r.category && r.limit_amount)
    };
    if (budgetId) await api.patch(`/budgets/${budgetId}/`, payload);
    else await api.post("/budgets/", payload);

    setMessage("Budget saved.");
    await load();
  };

  return (
    <section className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading text-xl font-extrabold sm:text-2xl text-slate-800 dark:text-slate-100">Budget Management</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Define your total monthly spending threshold and slice limits per category</p>
      </div>

      <form onSubmit={save} className="space-y-5 rounded-2xl glass-panel p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            placeholder="Year"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            placeholder="Month"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Total monthly budget"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            required
          />
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Category Budgets</p>
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
              <select
                value={row.category}
                onChange={(e) => updateRow(idx, "category", e.target.value)}
                className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Limit amount"
                value={row.limit_amount}
                onChange={(e) => updateRow(idx, "limit_amount", e.target.value)}
                className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="w-full rounded-xl border border-red-200 px-5 py-2 text-sm text-red-500 hover:bg-red-50 dark:border-red-950/30 dark:hover:bg-red-950/10 font-semibold md:w-auto transition-all duration-300"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/60">
          <button
            type="button"
            onClick={addRow}
            className="w-full rounded-xl border border-slate-250 hover:bg-slate-50 dark:border-slate-750 dark:hover:bg-slate-905 px-4 py-2 text-sm font-bold md:w-auto transition-all duration-300"
          >
            Add category limit
          </button>
          <button className="w-full rounded-xl bg-gradient-to-r from-[#ff6b4a] to-[#e05334] text-white font-bold text-sm px-5 py-2 shadow-md shadow-[#ff6b4a]/20 hover:shadow-glow-coral active:scale-95 transition-all duration-300 md:w-auto">
            Save budget
          </button>
        </div>
        {message && <p className="text-sm text-mint font-semibold">{message}</p>}
      </form>
    </section>
  );
}
