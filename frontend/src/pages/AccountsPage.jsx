import { useEffect, useState } from "react";
import { api } from "../lib/api";

const initialForm = {
  name: "",
  account_type: "bank",
  currency: "INR",
  opening_balance: "",
  is_active: true
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Wallet" },
  { value: "credit", label: "Credit Card" },
  { value: "other", label: "Other" }
];

const ACCOUNT_TYPE_LABELS = Object.fromEntries(
  ACCOUNT_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  const load = async () => {
    const resp = await api.get("/wallets/?ordering=name");
    setAccounts(resp.data.results || resp.data || []);
  };

  useEffect(() => {
    load().catch(() => setAccounts([]));
  }, []);

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
      const payload = { ...form, currency: "INR" };
      if (editingId) {
        await api.patch(`/wallets/${editingId}/`, payload);
        setMessage("Wallet updated.");
      } else {
        await api.post("/wallets/", payload);
        setMessage("Wallet created.");
      }
      reset();
      await load();
    } catch (err) {
      const detail = err?.response?.data;
      if (typeof detail === "string") setError(detail);
      else if (detail?.name?.[0]) setError(detail.name[0]);
      else setError("Could not save wallet.");
    }
  };

  const onEdit = (account) => {
    const accountTypeExists = ACCOUNT_TYPE_OPTIONS.some((option) => option.value === account.account_type);
    setEditingId(account.id);
    setForm({
      name: account.name || "",
      account_type: accountTypeExists ? account.account_type : "bank",
      currency: "INR",
      opening_balance: account.opening_balance || "",
      is_active: !!account.is_active
    });
    setError("");
    setMessage("");
  };

  const onDelete = async (id) => {
    await api.delete(`/wallets/${id}/`);
    await load();
    if (editingId === id) reset();
  };

  return (
    <section className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-extrabold sm:text-2xl text-slate-800 dark:text-slate-100">Accounts & Wallets</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Manage cash accounts, credit cards, bank profiles, and opening balances</p>
        </div>
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900/60 p-1 border border-slate-200/40 dark:border-slate-800/40 select-none">
          <button
            onClick={() => setViewMode("grid")}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${viewMode === "grid" ? "bg-white dark:bg-slate-800 shadow-sm text-slate-850 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Card Grid</span>
          </button>
          <button
            onClick={() => setViewMode("list")}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${viewMode === "list" ? "bg-white dark:bg-slate-800 shadow-sm text-slate-850 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>List Table</span>
          </button>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl glass-panel p-5 md:grid-cols-5"
      >
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          required
        />
        <select
          value={form.account_type}
          onChange={(e) => setForm((prev) => ({ ...prev, account_type: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        >
          {ACCOUNT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          value="INR"
          readOnly
          aria-readonly="true"
          className="rounded-xl border border-slate-200 bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-sm outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed"
        />
        <input
          type="text"
          inputMode="decimal"
          pattern="^[0-9]+(\.[0-9]{1,2})?$"
          placeholder="Opening balance"
          aria-label="Opening balance"
          value={form.opening_balance}
          onChange={(e) => {
            const value = e.target.value;
            if (/^[0-9]*\.?[0-9]{0,2}$/.test(value)) {
              setForm((prev) => ({ ...prev, opening_balance: value }));
            }
          }}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          required
        />
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm text-slate-600 dark:text-slate-300 dark:border-slate-800 dark:bg-slate-950/40 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            className="rounded border-slate-300 text-[#22b9ae] focus:ring-[#22b9ae] h-4 w-4"
          />
          Active
        </label>
        <div className="flex flex-wrap items-center gap-2 md:col-span-5 pt-2">
          <button className="rounded-xl bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white font-bold text-sm px-5 py-2.5 shadow-md shadow-[#29d1c4]/20 hover:shadow-glow-teal active:scale-95 transition-all duration-300">
            {editingId ? "Update wallet" : "Add wallet"}
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
        {message && <p className="text-sm text-mint md:col-span-5">{message}</p>}
        {error && <p className="text-sm text-red-500 md:col-span-5">{error}</p>}
      </form>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => {
            // Determine premium card themes based on types
            let cardBg = "from-[#1e3a8a]/75 via-[#0284c7]/50 to-[#0c4a6e]/85 border-blue-500/20 shadow-blue-500/5";
            if (account.account_type === "cash") {
              cardBg = "from-[#065f46]/75 via-[#0d9488]/50 to-[#115e59]/85 border-emerald-500/20 shadow-emerald-500/5";
            } else if (account.account_type === "credit") {
              cardBg = "from-[#991b1b]/75 via-[#f97316]/50 to-[#7f1d1d]/85 border-rose-500/20 shadow-rose-500/5";
            } else if (account.account_type === "wallet") {
              cardBg = "from-[#6b21a8]/75 via-[#a855f7]/50 to-[#581c87]/85 border-purple-500/20 shadow-purple-500/5";
            }

            return (
              <div
                key={account.id}
                className={`relative h-48 rounded-[24px] p-6 text-white flex flex-col justify-between overflow-hidden shadow-lg border backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-glow-teal bg-gradient-to-tr ${cardBg}`}
              >
                {/* Visual Card chip & info */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                      {ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                    </span>
                    <span className="font-heading text-sm font-extrabold tracking-wide mt-0.5 truncate max-w-[140px]">
                      {account.name}
                    </span>
                  </div>
                  {/* Smart Card Chip */}
                  <svg className="w-8 h-6 text-amber-400/80 fill-current opacity-90" viewBox="0 0 32 24">
                    <rect x="2" y="2" width="28" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M2 10h12M18 10h12M12 2v8M20 2v8M12 14v8M20 14v8M2 14h12M18 14h12" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>

                {/* Card Number Mockup */}
                <div className="font-mono text-sm tracking-[0.25em] text-white/70 select-none z-10 py-1">
                  ••••  ••••  ••••  {String(account.id).padStart(4, "0")}
                </div>

                {/* Balance & Actions */}
                <div className="flex items-end justify-between z-10">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-50">Current Balance</span>
                    <span className="font-heading text-xl font-black tracking-wide mt-0.5">
                      ₹{(Number(account.current_balance) || Number(account.opening_balance) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-white/10 dark:bg-black/20 p-1.5 rounded-xl border border-white/10">
                    <button
                      onClick={() => onEdit(account)}
                      className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[10px] font-bold transition duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(account.id)}
                      className="rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 px-2.5 py-1 text-[10px] font-bold transition duration-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status indicator badge */}
                <span className={`absolute top-4 right-16 rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider z-10 ${account.is_active ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/20" : "bg-white/10 text-white/50 border border-white/10"}`}>
                  {account.is_active ? "Active" : "Paused"}
                </span>
              </div>
            );
          })}
          {!accounts.length && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-slate-400">
              No wallets configured yet. Get started by adding a wallet above!
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl glass-panel">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-100/50 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3.5 text-left">Name</th>
                <th className="px-4 py-3.5 text-left">Type</th>
                <th className="px-4 py-3.5 text-left">Currency</th>
                <th className="px-4 py-3.5 text-left">Opening</th>
                <th className="px-4 py-3.5 text-left">Current</th>
                <th className="px-4 py-3.5 text-left">Status</th>
                <th className="px-4 py-3.5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-slate-200/50 dark:border-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-900/40 transition-colors duration-200">
                  <td className="px-4 py-3.5 font-bold text-slate-850 dark:text-slate-200">{account.name}</td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-350">{ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}</td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{account.currency}</td>
                  <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">{account.opening_balance ? '₹' + account.opening_balance : ''}</td>
                  <td className="px-4 py-3.5 font-extrabold text-slate-800 dark:text-slate-100">{account.current_balance ? '₹' + account.current_balance : ''}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${account.is_active ? "bg-mint/10 text-mint" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}>
                      {account.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-3">
                      <button onClick={() => onEdit(account)} className="text-mint font-bold hover:underline">
                        Edit
                      </button>
                      <button onClick={() => onDelete(account.id)} className="text-red-500 font-bold hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!accounts.length && (
                <tr>
                  <td className="px-4 py-6 text-slate-400 text-center" colSpan={7}>
                    No wallets configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

