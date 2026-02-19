import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProfileMenu from "./ProfileMenu";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/transactions", label: "Transactions" },
  { to: "/budgets", label: "Budgets" },
  { to: "/reports", label: "Reports" }
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/75 backdrop-blur dark:border-slate-700 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-3">
          <Link to="/" className="flex items-center">
            <img src="/logo.svg" alt="Money Diary logo" className="h-10 w-auto sm:h-12" />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <ProfileMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="overflow-x-auto rounded-xl bg-white/70 p-2 shadow-soft dark:bg-slate-900/70 lg:h-fit lg:rounded-2xl lg:p-3">
          <p className="mb-3 hidden px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:block">
            {user?.full_name || user?.username}
          </p>
          <nav className="flex items-center gap-1 lg:block lg:space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-ink text-white dark:bg-slate-100 dark:text-slate-900"
                      : "hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
