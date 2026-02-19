import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((v) => !v)}
      className="rounded-lg border border-slate-300 bg-white/80 px-2.5 py-2 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 dark:border-slate-600 dark:bg-slate-800 sm:px-3 sm:text-sm"
    >
      <span className="sm:hidden">{dark ? "Light" : "Dark"}</span>
      <span className="hidden sm:inline">{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
