export default function AdminPage() {
  const adminUrl =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:8000/admin/"
      : "/admin/";

  return (
    <section className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading text-xl font-extrabold sm:text-2xl text-slate-800 dark:text-slate-100">Django Admin Portal</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Manage user profiles, tokens, transactions database, and raw ledger records directly</p>
      </div>

      <div className="rounded-2xl glass-panel p-2 h-[calc(100vh-210px)] overflow-hidden bg-white/10">
        <iframe
          src={adminUrl}
          title="Django Admin Console"
          className="w-full h-full rounded-xl border-0 bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </section>
  );
}
