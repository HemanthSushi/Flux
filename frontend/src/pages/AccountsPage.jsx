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
    <section className="space-y-6">
      <h2 className="font-heading text-xl font-extrabold sm:text-2xl">Accounts & Wallets</h2>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70 md:grid-cols-5"
      >
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        <select
          value={form.account_type}
          onChange={(e) => setForm((prev) => ({ ...prev, account_type: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
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
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          type="text"
          inputMode="decimal"
          pattern="^[0-9]+(\\.[0-9]{1,2})?$"
          placeholder="Opening balance"
          aria-label="Opening balance"
          value={form.opening_balance}
          onChange={(e) => {
            const value = e.target.value;
            if (/^[0-9]*\.?[0-9]{0,2}$/.test(value)) {
              setForm((prev) => ({ ...prev, opening_balance: value }));
            }
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
          />
          Active
        </label>
        <div className="flex flex-wrap items-center gap-2 md:col-span-5">
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-900">
            {editingId ? "Update wallet" : "Add wallet"}
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
        {message && <p className="text-sm text-mint md:col-span-5">{message}</p>}
        {error && <p className="text-sm text-red-600 md:col-span-5">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-2xl bg-white/70 shadow-soft dark:bg-slate-900/70">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100/90 dark:bg-slate-800/90">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Currency</th>
              <th className="px-3 py-2 text-left">Opening</th>
              <th className="px-3 py-2 text-left">Current</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-3 py-2 font-semibold">{account.name}</td>
                <td className="px-3 py-2">{ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}</td>
                <td className="px-3 py-2">{account.currency}</td>
                <td className="px-3 py-2">{account.opening_balance}</td>
                <td className="px-3 py-2">{account.current_balance}</td>
                <td className="px-3 py-2">{account.is_active ? "Active" : "Inactive"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-3">
                    <button onClick={() => onEdit(account)} className="font-semibold text-mint">
                      Edit
                    </button>
                    <button onClick={() => onDelete(account.id)} className="font-semibold text-red-600">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!accounts.length && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={7}>
                  No wallets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

