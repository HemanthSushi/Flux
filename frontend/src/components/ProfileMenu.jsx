import { useEffect, useMemo, useRef, useState } from "react";

export default function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const initials = useMemo(() => {
    const base = (user?.full_name || user?.username || "U").trim();
    const parts = base.split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [user]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        aria-label="Open profile menu"
        title="Profile"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-3 w-[min(18rem,calc(100vw-1rem))] rounded-2xl glass-panel p-4 shadow-xl">
          <div className="mb-3 border-b border-slate-200/50 pb-3 dark:border-slate-800/60">
            <p className="font-bold text-slate-800 dark:text-slate-100">{user?.full_name || user?.username || "User"}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">@{user?.username || "username"}</p>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">Email</span>
              <span className="font-semibold text-right truncate max-w-[10rem]">{user?.email || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Currency</span>
              <span className="font-semibold">{user?.currency || "INR"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Role</span>
              <span className="font-semibold capitalize">{user?.role || "user"}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#ff6b4a] to-[#e05334] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#ff6b4a]/20 hover:shadow-glow-coral active:scale-95 transition-all duration-300"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
