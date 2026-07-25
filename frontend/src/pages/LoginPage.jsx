import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "", remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const successMessage = location.state?.message || "";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(form.username, form.password, form.remember);
      navigate("/");
    } catch {
      setError("Invalid credentials.");
    }
  };

  const adminUrl =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:8000/admin/"
      : "/admin/";

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_32%),linear-gradient(135deg,_#f8fbfd_0%,_#ecf7f7_100%)] px-4 py-6 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_32%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)] dark:text-slate-100 sm:px-6 lg:px-8">
      {/* Top-Right Transparent Admin Portal Link */}
      <div className="absolute top-6 right-6 z-10">
        <a
          href={adminUrl}
          className="flex items-center gap-2 rounded-2xl border border-slate-200/50 bg-white/30 backdrop-blur-md px-4 py-2 text-xs font-bold tracking-wide uppercase transition hover:bg-white/60 active:scale-95 shadow-soft text-slate-600 hover:text-slate-800 dark:border-slate-800/50 dark:bg-slate-950/20 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-[#22b9ae]">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Admin Portal</span>
        </a>
      </div>

      <div className="mx-auto flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] max-w-2xl overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-1 flex-col justify-center px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[18rem]">
            <div className="mb-3 flex items-center gap-3">
              <img src="/icon-512-maskable.png" alt="Flux logo" className="h-10 w-10 rounded-2xl shadow-lg shadow-cyan-200/60" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#22b9ae]">Flux</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Simple, smart finance control</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-6">
              <div className="mb-5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#22b9ae]">Welcome back</p>
                <h1 className="text-[1.75rem] font-semibold text-slate-900 dark:text-slate-100">
                  Sign in to your account
                </h1>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Track spending, manage budgets, and review insights in one place.
                </p>
              </div>

              {successMessage && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:border-emerald-950/30 dark:bg-emerald-950/20 dark:text-emerald-400 animate-fade-in">
                  {successMessage}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Username</label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:bg-white dark:border-slate-700 dark:bg-slate-900"
                    placeholder="Enter your username"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
                    <Link className="text-xs font-semibold text-[#22b9ae] hover:text-[#1da79b]" to="/forgot-password">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-3 pr-10 py-2 text-sm outline-none transition focus:border-[#29d1c4] focus:bg-white dark:border-slate-700 dark:bg-slate-900"
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-400"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.remember}
                      onChange={(e) => setForm((p) => ({ ...p, remember: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-[#22b9ae] focus:ring-[#22b9ae]"
                    />
                    Remember me
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Secure session</span>
                </label>

                {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

                <button className="w-full rounded-2xl bg-[#29d1c4] px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-cyan-200/40 transition hover:opacity-90">
                  Sign in
                </button>
              </form>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>New here?</span>
                <Link className="font-semibold text-[#22b9ae] hover:text-[#1da79b]" to="/register">
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#2dd4bf] p-5 lg:flex">
          <div className="max-w-[15rem] rounded-[28px] border border-white/15 bg-white/10 p-4 text-white shadow-2xl backdrop-blur">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
                <path d="M4 17h16" />
                <path d="M7 13V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" />
                <path d="M8 17v-3h8v3" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Make every rupee count</h2>
            <p className="mt-2 text-sm leading-5 text-slate-200">
              See balances, automate recurring bills, and build better habits with a calm, clear dashboard.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#29d1c4]" />
                Smart budgeting insights
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#29d1c4]" />
                Secure account access
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#29d1c4]" />
                Clear weekly summaries
              </li>
            </ul>
          </div>
        </div>
      </div>
      {/* Watermark */}
      <div className="absolute bottom-6 right-6 select-none flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500/60 dark:text-slate-400/60">
        <span>⚡</span>
        <span>HS Builds</span>
      </div>
    </div>
  );
}
