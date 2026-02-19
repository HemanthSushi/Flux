export default function StatCard({ title, value, accent = "coral" }) {
  const accentMap = {
    coral: "border-coral",
    mint: "border-mint",
    slate: "border-slate-400"
  };

  return (
    <div
      className={`rounded-2xl border-l-4 bg-panel-light p-5 shadow-soft dark:bg-panel-dark ${accentMap[accent] || accentMap.coral}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
        {title}
      </p>
      <p className="mt-2 text-2xl font-extrabold font-heading">{value}</p>
    </div>
  );
}
