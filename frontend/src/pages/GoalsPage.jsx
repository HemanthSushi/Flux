import { useEffect, useState } from "react";
import { api } from "../lib/api";

const initialForm = {
  name: "",
  target_amount: "",
  current_amount: "0.00",
  target_date: "",
  linked_account: "",
  status: "active",
  notes: ""
};

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [contributionInput, setContributionInput] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [goalsResp, walletsResp] = await Promise.all([
      api.get("/goals/"),
      api.get("/wallets/?is_active=true")
    ]);
    setGoals(goalsResp.data.results || goalsResp.data || []);
    setWallets(walletsResp.data.results || walletsResp.data || []);
  };

  useEffect(() => {
    load().catch(() => setGoals([]));
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
      const payload = {
        ...form,
        linked_account: form.linked_account || null,
        target_date: form.target_date || null
      };
      if (editingId) {
        await api.patch(`/goals/${editingId}/`, payload);
        setMessage("Goal updated.");
      } else {
        await api.post("/goals/", payload);
        setMessage("Goal created.");
      }
      reset();
      await load();
    } catch (err) {
      const detail = err?.response?.data;
      if (detail?.name?.[0]) setError(detail.name[0]);
      else if (detail?.target_amount?.[0]) setError(detail.target_amount[0]);
      else setError("Could not save goal.");
    }
  };

  const onEdit = (goal) => {
    setEditingId(goal.id);
    setForm({
      name: goal.name || "",
      target_amount: goal.target_amount || "",
      current_amount: goal.current_amount || "0.00",
      target_date: goal.target_date || "",
      linked_account: goal.linked_account ? String(goal.linked_account) : "",
      status: goal.status || "active",
      notes: goal.notes || ""
    });
    setMessage("");
    setError("");
  };

  const onDelete = async (id) => {
    await api.delete(`/goals/${id}/`);
    await load();
    if (editingId === id) reset();
  };

  const onContribute = async (goalId) => {
    const amount = contributionInput[goalId];
    if (!amount) return;
    setError("");
    setMessage("");
    try {
      await api.post(`/goals/${goalId}/contribute/`, { amount });
      setContributionInput((prev) => ({ ...prev, [goalId]: "" }));
      setMessage("Contribution added.");
      await load();
    } catch {
      setError("Could not add contribution.");
    }
  };

  return (
    <section className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading text-xl font-extrabold sm:text-2xl text-slate-800 dark:text-slate-100">Financial Goals</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Plan and track your long-term savings target, down payments, and investment objectives</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl glass-panel p-5 md:grid-cols-4"
      >
        <input
          placeholder="Goal name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Target amount"
          value={form.target_amount}
          onChange={(e) => setForm((prev) => ({ ...prev, target_amount: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Current amount"
          value={form.current_amount}
          onChange={(e) => setForm((prev) => ({ ...prev, current_amount: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        />
        <input
          type="date"
          value={form.target_date}
          onChange={(e) => setForm((prev) => ({ ...prev, target_date: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        />
        <select
          value={form.linked_account}
          onChange={(e) => setForm((prev) => ({ ...prev, linked_account: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        >
          <option value="">No linked wallet</option>
          {wallets.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name}
            </option>
          ))}
        </select>
        <select
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white/60 px-3.5 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40 md:col-span-2"
        />
        <div className="flex items-center gap-2 md:col-span-4 pt-2">
          <button className="rounded-xl bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white font-bold text-sm px-5 py-2.5 shadow-md shadow-[#29d1c4]/20 hover:shadow-glow-teal active:scale-95 transition-all duration-300">
            {editingId ? "Update goal" : "Create goal"}
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

      <div className="grid grid-cols-1 gap-5">
        {goals.map((goal) => (
          <article key={goal.id} className="rounded-2xl glass-panel p-5 hover:scale-[1.01] hover:shadow-md transition-all duration-300">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{goal.name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Target: ₹{goal.target_amount}</span>
                  <span>•</span>
                  <span>Current: ₹{goal.current_amount}</span>
                  <span>•</span>
                  <span className={`capitalize font-bold ${goal.status === "completed" ? "text-mint" : goal.status === "paused" ? "text-slate-400" : "text-[#29d1c4]"}`}>
                    {goal.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 text-xs">
                <button onClick={() => onEdit(goal)} className="text-mint font-bold hover:underline">
                  Edit
                </button>
                <button onClick={() => onDelete(goal.id)} className="text-red-500 font-bold hover:underline">
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-gradient-to-r from-[#29d1c4] to-[#1da79b]"
                style={{ width: `${Math.min(Number(goal.progress_percentage || 0), 100)}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="font-extrabold text-[#1da79b]">
                {Number(goal.progress_percentage || 0).toFixed(1)}% Completed
              </span>
              <span className="text-slate-400">
                Remaining: <span className="font-semibold text-slate-600 dark:text-slate-300">₹{goal.remaining_amount}</span>
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60">
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={contributionInput[goal.id] || ""}
                onChange={(e) =>
                  setContributionInput((prev) => ({ ...prev, [goal.id]: e.target.value }))
                }
                className="rounded-xl border border-slate-200 bg-white/60 px-3 py-1.5 text-xs outline-none transition focus:border-[#29d1c4] focus:ring-2 focus:ring-[#29d1c4]/15 dark:border-slate-800 dark:bg-slate-950/40 w-32"
              />
              <button
                type="button"
                onClick={() => onContribute(goal.id)}
                className="rounded-xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:opacity-90 px-4 py-1.5 text-xs font-bold transition-all duration-300"
              >
                Contribute
              </button>
            </div>
          </article>
        ))}
        {!goals.length && (
          <div className="rounded-2xl glass-panel p-6 text-center text-sm text-slate-400">
            No savings goals defined yet.
          </div>
        )}
      </div>
    </section>
  );
}
