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
        account: form.account || null,
        end_date: form.end_date || null,
        interval: Number(form.interval || 1)
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
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-heading text-xl font-extrabold sm:text-2xl">Recurring Transactions</h2>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Run Due Date</span>
          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <button
          type="button"
          onClick={onRunDue}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Run due generator
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70 md:grid-cols-4"
      >
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction Type</span>
          <select
            value={form.txn_type}
            onChange={(e) => setForm((prev) => ({ ...prev, txn_type: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</span>
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="Amount"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</span>
          <select
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
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
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Wallet</span>
          <select
            value={form.account}
            onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
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
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Frequency</span>
          <select
            value={form.frequency}
            onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Interval</span>
          <input
            type="number"
            min={1}
            value={form.interval}
            onChange={(e) => setForm((prev) => ({ ...prev, interval: e.target.value }))}
            placeholder="Interval"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</span>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Next Run Date</span>
          <input
            type="date"
            value={form.next_run_date}
            onChange={(e) => setForm((prev) => ({ ...prev, next_run_date: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            End Date (Optional)
          </span>
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes (Optional)</span>
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>

        <div className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Auto Create</span>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
            <input
              type="checkbox"
              checked={form.auto_create}
              onChange={(e) => setForm((prev) => ({ ...prev, auto_create: e.target.checked }))}
            />
            Enable
          </label>
        </div>

        <div className="space-y-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            Active
          </label>
        </div>

        <div className="flex items-center gap-2 md:col-span-4">
          <button className="rounded-lg bg-coral px-4 py-2 text-sm font-bold text-white">
            {editingId ? "Update recurring" : "Add recurring"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          )}
        </div>
        {message && <p className="text-sm text-mint md:col-span-4">{message}</p>}
        {error && <p className="text-sm text-red-600 md:col-span-4">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-2xl bg-white/70 shadow-soft dark:bg-slate-900/70">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100/90 dark:bg-slate-800/90">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Amount</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Wallet</th>
              <th className="px-3 py-2 text-left">Frequency</th>
              <th className="px-3 py-2 text-left">Next run</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-3 py-2 capitalize">{item.txn_type}</td>
                <td className="px-3 py-2">{item.amount}</td>
                <td className="px-3 py-2">{item.category_name || "Uncategorized"}</td>
                <td className="px-3 py-2">{item.account_name || "-"}</td>
                <td className="px-3 py-2">
                  Every {item.interval} {item.frequency}
                </td>
                <td className="px-3 py-2">{item.next_run_date}</td>
                <td className="px-3 py-2">{item.is_active ? "Active" : "Inactive"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-3">
                    <button onClick={() => onEdit(item)} className="font-semibold text-mint">
                      Edit
                    </button>
                    <button onClick={() => onDelete(item.id)} className="font-semibold text-red-600">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={8}>
                  No recurring schedules configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
