import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const initialForm = {
  txn_type: "expense",
  amount: "",
  category: "",
  date: new Date().toISOString().split("T")[0],
  notes: ""
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ search: "", txn_type: "" });
  const [customCategory, setCustomCategory] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const load = async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (filters.search) params.set("search", filters.search);
    if (filters.txn_type) params.set("txn_type", filters.txn_type);

    const [txResp, catResp] = await Promise.all([
      api.get(`/transactions/?${params.toString()}`),
      api.get("/categories/")
    ]);
    setTransactions(txResp.data.results || []);
    setTotalPages(Math.ceil((txResp.data.count || 1) / 10));
    setCategories(catResp.data.results || catResp.data);
  };

  useEffect(() => {
    load().catch(() => setTransactions([]));
  }, [page, filters.search, filters.txn_type]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setCategoryError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setCategoryError("");
    try {
      if (editingId) await api.patch(`/transactions/${editingId}/`, form);
      else await api.post("/transactions/", form);
      resetForm();
      await load();
    } catch (err) {
      const categoryIssue = err?.response?.data?.category;
      if (Array.isArray(categoryIssue)) setCategoryError(categoryIssue[0]);
      else if (typeof categoryIssue === "string") setCategoryError(categoryIssue);
      else setCategoryError("Could not save transaction.");
    }
  };

  const onEdit = (tx) => {
    setEditingId(tx.id);
    setForm({
      txn_type: tx.txn_type,
      amount: tx.amount,
      category: tx.category ? String(tx.category) : "",
      date: tx.date,
      notes: tx.notes || ""
    });
  };

  const onDelete = async (id) => {
    await api.delete(`/transactions/${id}/`);
    await load();
  };

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
    if (form.txn_type === "income") {
      if (incomeCategory && String(form.category) !== String(incomeCategory.id)) {
        setForm((prev) => ({ ...prev, category: String(incomeCategory.id) }));
      }
      return;
    }
    const selected = categories.find((cat) => String(cat.id) === String(form.category));
    if (selected?.name?.toLowerCase() === "salary") {
      setForm((prev) => ({ ...prev, category: "" }));
    }
  }, [form.txn_type, incomeCategory, categories]);

  const onAddCustomCategory = async () => {
    const name = customCategory.trim();
    if (!name) return;

    setCategoryMessage("");
    setCategoryError("");
    try {
      const resp = await api.post("/categories/", { name });
      setCustomCategory("");
      setCategoryMessage("Custom expense category added.");
      await load();
      if (form.txn_type === "expense") {
        setForm((prev) => ({ ...prev, category: String(resp.data.id) }));
      }
    } catch (err) {
      const nameIssue = err?.response?.data?.name;
      if (Array.isArray(nameIssue)) setCategoryError(nameIssue[0]);
      else if (typeof nameIssue === "string") setCategoryError(nameIssue);
      else setCategoryError("Could not create category.");
    }
  };

  return (
    <section className="space-y-6">
      <h2 className="font-heading text-xl font-extrabold sm:text-2xl">Income & Expense Management</h2>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70 md:grid-cols-5"
      >
        <select
          value={form.txn_type}
          onChange={(e) => {
            setCategoryError("");
            setForm((p) => ({ ...p, txn_type: e.target.value }));
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        <select
          value={form.category}
          onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        >
          <option value="">
            {form.txn_type === "income" ? "Salary" : "Select expense category"}
          </option>
          {availableCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 md:col-span-3"
        />
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <button className="w-full rounded-lg bg-mint px-4 py-2 text-sm font-bold text-white sm:w-auto">
            {editingId ? "Update" : "Add"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="w-full rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold sm:w-auto"
            >
              Cancel
            </button>
          )}
        </div>
        {categoryError && <p className="text-sm text-red-600 md:col-span-5">{categoryError}</p>}
      </form>

      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70 md:grid-cols-[1fr_auto]">
        <input
          placeholder="Add custom expense category"
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={onAddCustomCategory}
          className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-900 md:w-auto"
        >
          Add category
        </button>
        {categoryMessage && <p className="text-sm text-mint md:col-span-2">{categoryMessage}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70 md:grid-cols-2">
        <input
          placeholder="Search notes/category/type"
          value={filters.search}
          onChange={(e) => {
            setPage(1);
            setFilters((p) => ({ ...p, search: e.target.value }));
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <select
          value={filters.txn_type}
          onChange={(e) => {
            setPage(1);
            setFilters((p) => ({ ...p, txn_type: e.target.value }));
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      <div className="sm:hidden space-y-3">
        {transactions.map((tx) => (
          <div key={tx.id} className="rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{tx.date}</p>
                <p className="mt-1 text-sm font-semibold capitalize">{tx.txn_type}</p>
              </div>
              <p className="text-sm font-bold">{tx.amount}</p>
            </div>
            <p className="mt-2 text-sm">{tx.category_name || "Uncategorized"}</p>
            {tx.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{tx.notes}</p>}
            <div className="mt-3 flex gap-3 text-sm">
              <button onClick={() => onEdit(tx)} className="font-semibold text-mint">
                Edit
              </button>
              <button onClick={() => onDelete(tx.id)} className="font-semibold text-red-600">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl bg-white/70 shadow-soft dark:bg-slate-900/70 sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100/90 dark:bg-slate-800/90">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Amount</th>
              <th className="px-3 py-2 text-left">Notes</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-3 py-2">{tx.date}</td>
                <td className="px-3 py-2 capitalize">{tx.txn_type}</td>
                <td className="px-3 py-2">{tx.category_name || "Uncategorized"}</td>
                <td className="px-3 py-2">{tx.amount}</td>
                <td className="px-3 py-2">{tx.notes}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(tx)} className="text-mint font-semibold">
                      Edit
                    </button>
                    <button onClick={() => onDelete(tx.id)} className="text-red-600 font-semibold">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2 sm:justify-end">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-slate-400 px-3 py-1 text-sm disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-sm font-semibold">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-400 px-3 py-1 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
}
