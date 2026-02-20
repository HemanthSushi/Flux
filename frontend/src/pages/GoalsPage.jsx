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
    <section className="space-y-6">
      <h2 className="font-heading text-xl font-extrabold sm:text-2xl">Financial Goals</h2>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70 md:grid-cols-4"
      >
        <input
          placeholder="Goal name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Target amount"
          value={form.target_amount}
          onChange={(e) => setForm((prev) => ({ ...prev, target_amount: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Current amount"
          value={form.current_amount}
          onChange={(e) => setForm((prev) => ({ ...prev, current_amount: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          type="date"
          value={form.target_date}
          onChange={(e) => setForm((prev) => ({ ...prev, target_date: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <select
          value={form.linked_account}
          onChange={(e) => setForm((prev) => ({ ...prev, linked_account: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
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
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
        <input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 md:col-span-2"
        />
        <div className="flex items-center gap-2 md:col-span-4">
          <button className="rounded-lg bg-mint px-4 py-2 text-sm font-bold text-white">
            {editingId ? "Update goal" : "Create goal"}
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

      <div className="grid grid-cols-1 gap-4">
        {goals.map((goal) => (
          <article key={goal.id} className="rounded-2xl bg-white/70 p-4 shadow-soft dark:bg-slate-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">{goal.name}</h3>
                <p className="text-xs text-slate-500">
                  Target: {goal.target_amount} | Current: {goal.current_amount} | Status: {goal.status}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <button onClick={() => onEdit(goal)} className="font-semibold text-mint">
                  Edit
                </button>
                <button onClick={() => onDelete(goal.id)} className="font-semibold text-red-600">
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-3 h-2 rounded bg-slate-200 dark:bg-slate-700">
              <div
                className="h-2 rounded bg-coral"
                style={{ width: `${Math.min(Number(goal.progress_percentage || 0), 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Progress: {Number(goal.progress_percentage || 0).toFixed(1)}% | Remaining:{" "}
              {goal.remaining_amount}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Add contribution"
                value={contributionInput[goal.id] || ""}
                onChange={(e) =>
                  setContributionInput((prev) => ({ ...prev, [goal.id]: e.target.value }))
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => onContribute(goal.id)}
                className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold"
              >
                Contribute
              </button>
            </div>
          </article>
        ))}
        {!goals.length && (
          <div className="rounded-2xl bg-white/70 p-4 text-sm text-slate-500 shadow-soft dark:bg-slate-900/70">
            No goals yet.
          </div>
        )}
      </div>
    </section>
  );
}
