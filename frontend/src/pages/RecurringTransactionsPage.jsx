import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const today = new Date().toISOString().split("T")[0];

const initialForm = {
  txn_type: "expense",
  amount: "",
  category: "",
  account: "",
  notes: "",
  frequency: "monthly",
  interval: 1,
  start_date: today,
  next_run_date: today,
  end_date: "",
  auto_create: true,
  is_active: true
};

export default function RecurringTransactionsPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [runDate, setRunDate] = useState(today);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [recurringResp, categoryResp, accountResp] = await Promise.all([
      api.get("/recurring-transactions/?ordering=next_run_date"),
      api.get("/categories/"),
      api.get("/wallets/?is_active=true")
    ]);
    setItems(recurringResp.data.results || recurringResp.data || []);
    setCategories(categoryResp.data.results || categoryResp.data || []);
    setAccounts(accountResp.data.results || accountResp.data || []);
  };

  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  const incomeCategory = useMemo(
    () => categories.find((cat) => cat.name?.toLowerCase() === "salary"),
    [categories]
  );

  const availableCategories = useMemo(() => {
    if (form.txn_type === "income") {
      return categories.filter((cat) => cat.name?.toLowerCase() === "salary");
    }
    return categories.filter((cat) => cat.name?.toLowerCase() !== "salary");
  }, [categories, form.txn_type]);

  useEffect(() => {
    if (form.txn_type === "income" && incomeCategory) {
      setForm((prev) => ({ ...prev, category: String(incomeCategory.id) }));
    }
    if (form.txn_type === "expense" && form.category) {
      const selected = categories.find((cat) => String(cat.id) === String(form.category));
      if (selected?.name?.toLowerCase() === "salary") {
        setForm((prev) => ({ ...prev, category: "" }));
      }
    }
  }, [form.txn_type, incomeCategory, categories]);

  const reset = () => {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        next_run_date: form.start_date, // Sync next run with start date on creation
        account: form.account || null,
        end_date: null,
        interval: 1,
        auto_create: true
      };
      if (editingId) {
        await api.patch(`/recurring-transactions/${editingId}/`, payload);
        setMessage("Recurring transaction updated.");
      } else {
        await api.post("/recurring-transactions/", payload);
        setMessage("Recurring transaction created.");
      }
      reset();
      await load();
    } catch (err) {
      const detail = err?.response?.data;
      if (typeof detail === "string") setError(detail);
      else if (detail?.non_field_errors?.[0]) setError(detail.non_field_errors[0]);
      else if (detail?.category?.[0]) setError(detail.category[0]);
      else setError("Could not save recurring transaction.");
    }
  };

  const onEdit = (item) => {
    setEditingId(item.id);
    setForm({
      txn_type: item.txn_type || "expense",
      amount: item.amount || "",
      category: item.category ? String(item.category) : "",
      account: item.account ? String(item.account) : "",
      notes: item.notes || "",
      frequency: item.frequency || "monthly",
      interval: item.interval || 1,
      start_date: item.start_date || today,
      next_run_date: item.next_run_date || today,
      end_date: item.end_date || "",
      auto_create: !!item.auto_create,
      is_active: !!item.is_active
    });
    setMessage("");
    setError("");
  };

  const onDelete = async (id) => {
    await api.delete(`/recurring-transactions/${id}/`);
    await load();
    if (editingId === id) reset();
  };

  const onRunDue = async () => {
    setError("");
    setMessage("");
    try {
      const resp = await api.post("/recurring-transactions/run_due/", { as_of: runDate });
      const data = resp.data || {};
      setMessage(
        `Run complete. Generated ${data.generated_transactions || 0}, processed ${data.processed_schedules || 0}.`
      );
      await load();
    } catch {
      setError("Could not run recurring generator.");
    }
  };

  return (
    <section className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-extrabold sm:text-2xl text-slate-800 dark:text-slate-100">Recurring Transactions</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Automate your fixed bills, salaries, rents, and subscriptions on specific intervals</p>
        </div>
        {/* Hidden Developer/Run-Due Utility accessible for diagnostic actions */}
        <button
          onClick={onRunDue}
          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-[#29d1c4] transition font-bold uppercase tracking-wider border border-slate-200/55 dark:border-slate-800/40 rounded-xl px-3 py-1.5"
        >
          Diagnose Schedules
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 rounded-2xl glass-panel p-5 md:grid-cols-4"
      >
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Transaction Type</span>
          <select
            value={form.txn_type}
            onChange={(e) => setForm((prev) => ({ ...prev, txn_type: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Amount</span>
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="Amount"
            className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Category</span>
          <select
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            required
          >
            <option value="">Select category</option>
            {availableCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Wallet</span>
          <select
            value={form.account}
            onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          >
            <option value="">No wallet</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Frequency</span>
          <select
            value={form.frequency}
            onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Start Date</span>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
            required
          />
        </label>

        <div className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Status</span>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm text-slate-600 dark:text-slate-350 dark:border-slate-800 dark:bg-slate-950/40 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-slate-300 text-[#22b9ae] focus:ring-[#22b9ae] h-4 w-4"
            />
            Active Schedule
          </label>
        </div>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Notes (Optional)</span>
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          />
        </label>

        <div className="flex items-center gap-2 md:col-span-4 pt-2 border-t border-slate-200/50 dark:border-slate-800/40">
          <button className="rounded-xl bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white font-bold text-sm px-5 py-2.5 shadow-md shadow-[#29d1c4]/20 hover:shadow-glow-teal active:scale-95 transition-all duration-300">
            {editingId ? "Update recurring" : "Add recurring"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-905 transition-all duration-300"
            >
              Cancel
            </button>
          )}
        </div>
        {message && <p className="text-sm text-mint md:col-span-4 font-semibold">{message}</p>}
        {error && <p className="text-sm text-red-500 md:col-span-4">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-2xl glass-panel">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-slate-100/50 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="px-4 py-3.5 text-left">Type</th>
              <th className="px-4 py-3.5 text-left">Amount</th>
              <th className="px-4 py-3.5 text-left">Category</th>
              <th className="px-4 py-3.5 text-left">Wallet</th>
              <th className="px-4 py-3.5 text-left">Frequency</th>
              <th className="px-4 py-3.5 text-left">Next run</th>
              <th className="px-4 py-3.5 text-left">Status</th>
              <th className="px-4 py-3.5 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-200/50 dark:border-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-900/40 transition-colors duration-200">
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${item.txn_type === "income" ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"}`}>
                    {item.txn_type}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-100">₹{item.amount}</td>
                <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-350">{item.category_name || "Uncategorized"}</td>
                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{item.account_name || "-"}</td>
                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                  Every {item.interval} {item.frequency}
                </td>
                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{item.next_run_date}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${item.is_active ? "bg-mint/10 text-mint" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}>
                    {item.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex gap-3">
                    <button onClick={() => onEdit(item)} className="text-mint font-bold hover:underline">
                      Edit
                    </button>
                    <button onClick={() => onDelete(item.id)} className="text-red-500 font-bold hover:underline">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="px-4 py-6 text-slate-400 text-center" colSpan={8}>
                  No recurring schedules configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
