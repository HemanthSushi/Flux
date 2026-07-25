import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const initialForm = {
  txn_type: "expense",
  amount: "",
  category: "",
  account: "",
  date: new Date().toISOString().split("T")[0],
  notes: ""
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ search: "", txn_type: "", account: "" });
  const [customCategory, setCustomCategory] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptCreateTransaction, setReceiptCreateTransaction] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptMessage, setReceiptMessage] = useState("");
  const [receiptResult, setReceiptResult] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const load = async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (filters.search) params.set("search", filters.search);
    if (filters.txn_type) params.set("txn_type", filters.txn_type);
    if (filters.account) params.set("account", filters.account);

    const [txResp, catResp, accountResp] = await Promise.all([
      api.get(`/transactions/?${params.toString()}`),
      api.get("/categories/"),
      api.get("/wallets/?is_active=true")
    ]);
    setTransactions(txResp.data.results || []);
    setTotalPages(Math.ceil((txResp.data.count || 1) / 10));
    setCategories(catResp.data.results || catResp.data);
    setAccounts(accountResp.data.results || accountResp.data || []);
  };

  useEffect(() => {
    load().catch(() => setTransactions([]));
  }, [page, filters.search, filters.txn_type, filters.account]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setCategoryError("");
    setAiSuggestion(null);
    setAiError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setCategoryError("");
    try {
      const feedbackPayload =
        aiSuggestion && form.txn_type === "expense" && form.notes.trim() && form.category
          ? {
              description: form.notes.trim(),
              predicted_category: aiSuggestion.category_id || null,
              corrected_category: Number(form.category),
              confidence: aiSuggestion.confidence,
              was_accepted:
                !!aiSuggestion.category_id && Number(form.category) === Number(aiSuggestion.category_id),
              source: "manual"
            }
          : null;

      const txPayload = { ...form, account: form.account || null };
      let txResp = null;
      if (editingId) txResp = await api.patch(`/transactions/${editingId}/`, txPayload);
      else txResp = await api.post("/transactions/", txPayload);

      if (feedbackPayload) {
        await api
          .post("/ai/categorize/feedback/", {
            ...feedbackPayload,
            transaction: txResp?.data?.id || null
          })
          .catch(() => undefined);
      }

      resetForm();
      await load();
    } catch (err) {
      const categoryIssue = err?.response?.data?.category;
      const accountIssue = err?.response?.data?.account;
      if (Array.isArray(categoryIssue)) setCategoryError(categoryIssue[0]);
      else if (typeof categoryIssue === "string") setCategoryError(categoryIssue);
      else if (Array.isArray(accountIssue)) setCategoryError(accountIssue[0]);
      else if (typeof accountIssue === "string") setCategoryError(accountIssue);
      else setCategoryError("Could not save transaction.");
    }
  };

  const onEdit = (tx) => {
    setEditingId(tx.id);
    setForm({
      txn_type: tx.txn_type,
      amount: tx.amount,
      category: tx.category ? String(tx.category) : "",
      account: tx.account ? String(tx.account) : "",
      date: tx.date,
      notes: tx.notes || ""
    });
    setAiSuggestion(null);
    setAiError("");
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

  const selectedAccount = useMemo(
    () => accounts.find((account) => String(account.id) === String(form.account)),
    [accounts, form.account]
  );

  useEffect(() => {
    if (form.txn_type === "income") {
      if (incomeCategory && String(form.category) !== String(incomeCategory.id)) {
        setForm((prev) => ({ ...prev, category: String(incomeCategory.id) }));
      }
      setAiSuggestion(null);
      setAiError("");
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

  const onSuggestCategory = async () => {
    if (form.txn_type !== "expense") {
      setAiSuggestion(null);
      setAiError("");
      return;
    }

    if (!form.notes.trim()) {
      setAiError("Add transaction notes first to get an AI category suggestion.");
      setAiSuggestion(null);
      return;
    }

    setAiBusy(true);
    setAiError("");
    try {
      const resp = await api.post("/ai/categorize/", {
        description: form.notes.trim(),
        txn_type: form.txn_type
      });
      setAiSuggestion(resp.data);
      if (resp.data?.category_id) {
        setForm((prev) => ({ ...prev, category: String(resp.data.category_id) }));
      }
    } catch {
      setAiSuggestion(null);
      setAiError("Could not get AI category suggestion right now.");
    } finally {
      setAiBusy(false);
    }
  };

  const onUploadReceipt = async () => {
    if (!receiptFile) {
      setReceiptError("Select a receipt file first.");
      return;
    }

    setReceiptBusy(true);
    setReceiptError("");
    setReceiptMessage("");
    try {
      const formData = new FormData();
      formData.append("file", receiptFile);
      formData.append("txn_type", "expense");
      formData.append("create_transaction", String(receiptCreateTransaction));

      const resp = await api.post("/ai/receipt/ingest/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const data = resp.data;
      setReceiptResult(data);

      if (data.status === "imported") {
        setReceiptMessage("Receipt parsed and transaction auto-created.");
        setShowReceiptModal(true);
        await load();
      } else if (data.status === "failed") {
        setReceiptError(data.error_message || "Receipt parsing failed.");
      } else {
        setReceiptMessage("Receipt parsed successfully. Verify details below.");
        setShowReceiptModal(true);
      }
    } catch (err) {
      setReceiptError(
        err?.response?.data?.error_message ||
          err?.response?.data?.detail ||
          "Receipt upload failed."
      );
      if (err?.response?.data && typeof err.response.data === "object") {
        setReceiptResult(err.response.data);
      }
    } finally {
      setReceiptBusy(false);
    }
  };

  return (
    <section className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading text-xl font-extrabold sm:text-2xl text-slate-800 dark:text-slate-100">Transactions Ledger</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Manage and track your income, expenses, and AI receipt scans</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl glass-panel p-5 md:grid-cols-5"
      >
        <select
          value={form.txn_type}
          onChange={(e) => {
            setCategoryError("");
            setForm((p) => ({ ...p, txn_type: e.target.value }));
          }}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
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
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          required
        />
        <select
          value={form.category}
          onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
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
        <select
          value={form.account}
          onChange={(e) => setForm((p) => ({ ...p, account: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        >
          <option value="">No wallet</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          required
        />
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40 md:col-span-3"
        />
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <button className="w-full rounded-xl bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white font-bold text-sm px-5 py-2 shadow-md shadow-[#29d1c4]/20 hover:shadow-glow-teal active:scale-95 transition-all duration-300 sm:w-auto">
            {editingId ? "Update" : "Add"}
          </button>
          {form.txn_type === "expense" && (
            <button
              type="button"
              onClick={onSuggestCategory}
              disabled={aiBusy}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-905 sm:w-auto disabled:opacity-60 transition-all duration-300"
            >
              {aiBusy ? "Suggesting..." : "AI Suggest"}
            </button>
          )}
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-905 sm:w-auto transition-all duration-300"
            >
              Cancel
            </button>
          )}
        </div>
        {aiSuggestion && (
          <p className="text-sm text-slate-500 dark:text-slate-400 md:col-span-5">
            AI suggestion: <span className="font-semibold text-mint">{aiSuggestion.category_name}</span>{" "}
            (confidence {Math.round((aiSuggestion.confidence || 0) * 100)}%)
          </p>
        )}
        {selectedAccount && (
          <p className="text-xs text-slate-500 dark:text-slate-400 md:col-span-5">
            Using wallet: <span className="font-semibold">{selectedAccount.name}</span> ({selectedAccount.currency}) | Current balance:{" "}
            <span className="font-bold">₹{selectedAccount.current_balance}</span>
          </p>
        )}
        {aiError && <p className="text-sm text-red-500 md:col-span-5">{aiError}</p>}
        {categoryError && <p className="text-sm text-red-500 md:col-span-5">{categoryError}</p>}
      </form>

      <div className="relative overflow-hidden grid grid-cols-1 gap-3 rounded-2xl glass-panel p-5 md:grid-cols-[1fr_auto_auto] items-center">
        {/* Animated Laser Scanning Overlay */}
        {receiptBusy && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs flex flex-col items-center justify-center rounded-2xl z-20 animate-fade-in">
            <div className="relative w-14 h-14 border border-[#29d1c4]/30 rounded-xl flex items-center justify-center overflow-hidden bg-slate-950/80">
              {/* Laser line */}
              <div className="absolute left-0 w-full h-[3px] bg-[#29d1c4] shadow-glow-teal animate-laser-scan z-10" />
              {/* Doc Icon */}
              <svg className="w-7 h-7 text-[#29d1c4] opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-[10px] text-[#29d1c4] font-black tracking-[0.2em] uppercase mt-2.5 animate-pulse">AI Receipt Scanning...</p>
          </div>
        )}

        <input
          type="file"
          id="receipt-file-input"
          accept=".png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.pdf"
          onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
          className="rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/40"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={receiptCreateTransaction}
            onChange={(e) => setReceiptCreateTransaction(e.target.checked)}
            className="rounded border-slate-300 text-[#22b9ae] focus:ring-[#22b9ae] h-4 w-4"
          />
          Auto-create transaction
        </label>
        <button
          type="button"
          onClick={onUploadReceipt}
          disabled={receiptBusy}
          className="w-full rounded-xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90 px-5 py-2 text-sm font-bold md:w-auto disabled:opacity-60 transition-all duration-300"
        >
          Upload receipt
        </button>
        {receiptMessage && <p className="text-sm text-mint md:col-span-3">{receiptMessage}</p>}
        {receiptError && <p className="text-sm text-red-500 md:col-span-3">{receiptError}</p>}
        {receiptResult && (
          <div className="md:col-span-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p>
              Using wallet: {selectedAccount.name} ({selectedAccount.currency}) | Current balance: ₹{selectedAccount.current_balance}
            </p>
            <p>Date: {receiptResult.detected_date || "N/A"}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl glass-panel p-5 md:grid-cols-[1fr_auto]">
        <input
          placeholder="Add custom category"
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        />
        <button
          type="button"
          onClick={onAddCustomCategory}
          className="w-full rounded-xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90 px-5 py-2 text-sm font-bold md:w-auto transition-all duration-300"
        >
          Add category
        </button>
        {categoryMessage && <p className="text-sm text-mint md:col-span-2">{categoryMessage}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl glass-panel p-5 md:grid-cols-3">
        <input
          placeholder="Search notes/category/type"
          value={filters.search}
          onChange={(e) => {
            setPage(1);
            setFilters((p) => ({ ...p, search: e.target.value }));
          }}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        />
        <select
          value={filters.txn_type}
          onChange={(e) => {
            setPage(1);
            setFilters((p) => ({ ...p, txn_type: e.target.value }));
          }}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        >
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select
          value={filters.account}
          onChange={(e) => {
            setPage(1);
            setFilters((p) => ({ ...p, account: e.target.value }));
          }}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        >
          <option value="">All wallets</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:hidden space-y-3">
        {transactions.map((tx) => (
          <div key={tx.id} className="rounded-2xl glass-panel p-4 hover:scale-[1.01] transition-all duration-300">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{tx.date}</p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize mt-1.5 ${tx.txn_type === "income" ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"}`}>
                  {tx.txn_type}
                </span>
              </div>
              <p className={`text-sm font-extrabold ${tx.txn_type === "income" ? "text-mint" : "text-slate-800 dark:text-slate-100"}`}>
                ₹{tx.amount}
              </p>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">{tx.category_name || "Uncategorized"}</p>
            <p className="mt-1 text-[10px] text-slate-400">{tx.account_name || "No wallet"}</p>
            {tx.notes && <p className="mt-2 text-xs text-slate-500 border-l-2 border-slate-200 dark:border-slate-800 pl-2">{tx.notes}</p>}
            <div className="mt-4 flex gap-3 text-xs border-t border-slate-100 dark:border-slate-800/60 pt-3">
              <button onClick={() => onEdit(tx)} className="font-bold text-mint hover:underline">
                Edit
              </button>
              <button onClick={() => onDelete(tx.id)} className="font-bold text-red-500 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl glass-panel sm:block">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-slate-100/50 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="px-4 py-3.5 text-left">Date</th>
              <th className="px-4 py-3.5 text-left">Type</th>
              <th className="px-4 py-3.5 text-left">Category</th>
              <th className="px-4 py-3.5 text-left">Wallet</th>
              <th className="px-4 py-3.5 text-left">Amount</th>
              <th className="px-4 py-3.5 text-left">Notes</th>
              <th className="px-4 py-3.5 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-t border-slate-200/50 dark:border-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-900/40 transition-colors duration-200">
                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{tx.date}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${tx.txn_type === "income" ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"}`}>
                    {tx.txn_type}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">{tx.category_name || "Uncategorized"}</td>
                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{tx.account_name || "-"}</td>
                <td className={`px-4 py-3.5 font-bold text-sm ${tx.txn_type === "income" ? "text-mint" : "text-slate-800 dark:text-slate-100"}`}>
                  ₹{tx.amount}
                </td>
                <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={tx.notes}>{tx.notes}</td>
                <td className="px-4 py-3.5">
                  <div className="flex gap-3">
                    <button onClick={() => onEdit(tx)} className="text-mint font-bold hover:underline">
                      Edit
                    </button>
                    <button onClick={() => onDelete(tx.id)} className="text-red-500 font-bold hover:underline">
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
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 px-4 py-1.5 text-xs font-semibold hover:bg-white hover:-translate-y-0.5 disabled:opacity-50 disabled:-translate-y-0 active:scale-95 transition-all duration-300"
        >
          Prev
        </button>
        <span className="text-xs font-bold px-3">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 px-4 py-1.5 text-xs font-semibold hover:bg-white hover:-translate-y-0.5 disabled:opacity-50 disabled:-translate-y-0 active:scale-95 transition-all duration-300"
        >
          Next
        </button>
      </div>

      {/* AI Receipt Verification Modal */}
      {showReceiptModal && receiptResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass-panel p-6 shadow-2xl relative border border-white/20 animate-scale-up">
            <h3 className="font-heading text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="text-[#29d1c4] text-xl">✨</span> AI Ingestion Verification
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Verify and adjust the details extracted from your receipt.
            </p>

            <div className="my-5 space-y-4">
              {/* Form fields inside verification modal */}
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1 col-span-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Merchant / Description</span>
                  <input
                    type="text"
                    defaultValue={receiptResult.suggested_description || receiptResult.merchant || ""}
                    id="verify-description"
                    className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] dark:border-slate-800 dark:bg-slate-950/40"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={receiptResult.detected_amount || ""}
                    id="verify-amount"
                    className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] dark:border-slate-800 dark:bg-slate-950/40"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Date</span>
                  <input
                    type="date"
                    defaultValue={receiptResult.detected_date || new Date().toISOString().split("T")[0]}
                    id="verify-date"
                    className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] dark:border-slate-800 dark:bg-slate-950/40"
                  />
                </label>

                <label className="space-y-1 col-span-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Category</span>
                  <select
                    defaultValue={receiptResult.suggested_category || ""}
                    id="verify-category"
                    className="w-full rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Confidence Rating Progress */}
              {receiptResult.category_confidence && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>AI Confidence</span>
                    <span className="text-mint">{Math.round(receiptResult.category_confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-mint transition-all duration-500"
                      style={{ width: `${receiptResult.category_confidence * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200/50 dark:border-slate-800/40 pt-4">
              <button
                type="button"
                onClick={async () => {
                  if (receiptResult.status === "imported" && receiptResult.created_transaction_id) {
                    // If auto-created, delete the transaction to undo
                    try {
                      await api.delete(`/transactions/${receiptResult.created_transaction_id}/`);
                      await load();
                    } catch {}
                  }
                  setShowReceiptModal(false);
                  setReceiptResult(null);
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-905 transition duration-200"
              >
                {receiptResult.status === "imported" ? "Undo & Discard" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const desc = document.getElementById("verify-description")?.value || "";
                  const amt = document.getElementById("verify-amount")?.value || "";
                  const dt = document.getElementById("verify-date")?.value || "";
                  const cat = document.getElementById("verify-category")?.value || "";

                  if (receiptResult.status === "imported" && receiptResult.created_transaction_id) {
                    // Update the created transaction
                    try {
                      await api.patch(`/transactions/${receiptResult.created_transaction_id}/`, {
                        amount: amt,
                        date: dt,
                        category: cat || null,
                        notes: desc
                      });
                      await load();
                    } catch {}
                  } else {
                    // Populate the main transaction form
                    setForm((prev) => ({
                      ...prev,
                      amount: amt,
                      date: dt,
                      category: cat,
                      notes: desc
                    }));
                  }
                  setShowReceiptModal(false);
                  setReceiptResult(null);
                }}
                className="rounded-xl bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white font-bold text-xs px-5 py-2.5 shadow-md shadow-[#29d1c4]/20 hover:shadow-glow-teal active:scale-95 transition-all duration-300"
              >
                {receiptResult.status === "imported" ? "Confirm Details" : "Apply to Form"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
