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
        <div className="absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-1rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 border-b border-slate-200 pb-3 dark:border-slate-700">
            <p className="font-semibold">{user?.full_name || user?.username || "User"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">@{user?.username || "username"}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-semibold">Email:</span> {user?.email || "-"}
            </p>
            <p>
              <span className="font-semibold">Currency:</span> {user?.currency || "USD"}
            </p>
            <p className="capitalize">
              <span className="font-semibold">Role:</span> {user?.role || "user"}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="mt-4 w-full rounded-lg bg-coral px-3 py-2 text-sm font-bold text-white transition hover:opacity-90"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
