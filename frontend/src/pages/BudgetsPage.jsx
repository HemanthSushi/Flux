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
    <section className="space-y-5">
      <h2 className="font-heading text-xl font-extrabold sm:text-2xl">Budget Management</h2>

      <form onSubmit={save} className="space-y-4 rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Total monthly budget"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            required
          />
        </div>

        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
              <select
                value={row.category}
                onChange={(e) => updateRow(idx, "category", e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
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
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 md:w-auto"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addRow}
            className="w-full rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold sm:w-auto"
          >
            Add category limit
          </button>
          <button className="w-full rounded-lg bg-coral px-4 py-2 text-sm font-bold text-white sm:w-auto">
            Save budget
          </button>
        </div>
        {message && <p className="text-sm text-mint">{message}</p>}
      </form>
    </section>
  );
}
