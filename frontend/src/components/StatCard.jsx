export default function StatCard({ title, value, accent = "coral" }) {
  const iconMap = {
    mint: (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint/10 text-mint dark:bg-mint/20">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
          <path d="M23 6l-9.5 9.5-5-5L1 18" />
          <path d="M17 6h6v6" />
        </svg>
      </span>
    ),
    coral: (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-coral/10 text-coral dark:bg-coral/20">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
          <path d="M23 18l-9.5-9.5-5 5L1 6" />
          <path d="M17 18h6v-6" />
        </svg>
      </span>
    ),
    slate: (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500 dark:bg-cyan-500/20">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </span>
    )
  };

  const shadowMap = {
    mint: "hover:shadow-glow-mint",
    coral: "hover:shadow-glow-coral",
    slate: "hover:shadow-glow-teal"
  };

  return (
    <div
      className={`glass-panel flex items-center gap-4 rounded-2xl p-5 border border-white/20 dark:border-slate-800/40 hover:-translate-y-1 hover:bg-white/80 dark:hover:bg-slate-900/80 hover:scale-[1.01] ${shadowMap[accent] || "hover:shadow-lg"}`}
    >
      {iconMap[accent] || iconMap.coral}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {title}
        </p>
        <p className="mt-1 text-2xl font-extrabold font-heading text-slate-800 dark:text-slate-100 truncate">{value}</p>
      </div>
    </div>
  );
}
