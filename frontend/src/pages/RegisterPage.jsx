import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function extractErrorMessage(error, fallback = "Registration failed. Please verify all fields and try again.") {
  const data = error?.response?.data;
  if (!data) return "Registration failed. Check backend server and try again.";

  if (typeof data.detail === "string") return data.detail;
  if (typeof data.username?.[0] === "string") return `Username: ${data.username[0]}`;
  if (typeof data.password?.[0] === "string") return `Password: ${data.password[0]}`;
  if (typeof data.confirm_password?.[0] === "string") return `Confirm password: ${data.confirm_password[0]}`;
  if (typeof data.email?.[0] === "string") return `Email: ${data.email[0]}`;
  if (typeof data.non_field_errors?.[0] === "string") return data.non_field_errors[0];
  if (typeof data === "object") return `Request failed: ${JSON.stringify(data)}`;

  return fallback;
}


export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    full_name: ""
  });

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirm_password) {
      setError("Confirm password does not match.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        full_name: form.full_name
      });
      navigate("/login", { state: { message: "Account created successfully. Please sign in." } });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.2),_transparent_40%),linear-gradient(135deg,_#f8fbfd_0%,_#ecf7f7_100%)] px-4 py-8 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.12),_transparent_40%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)] dark:text-slate-100 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-4xl flex overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.3)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
        
        {/* Form Column */}
        <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            
            {/* Logo */}
            <div className="mb-6 flex items-center gap-3.5">
              <img src="/icon-512-maskable.png" alt="Flux logo" className="h-11 w-11 rounded-2xl shadow-lg shadow-cyan-200/60 dark:shadow-none" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#22b9ae]">Flux</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Simple, smart finance control</p>
              </div>
            </div>

            {/* Header info */}
            <div className="mb-6">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#22b9ae]">Get started</p>
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 dark:text-slate-100">
                Create your account
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Sign up and start tracking spending with a clean, simple dashboard.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              
              {/* Username & Full Name in a grid on larger screens */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Username</label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-[#29d1c4] focus:bg-white focus:ring-2 focus:ring-[#29d1c4]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:focus:bg-slate-900"
                    placeholder="john_doe"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Full name</label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-[#29d1c4] focus:bg-white focus:ring-2 focus:ring-[#29d1c4]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:focus:bg-slate-900"
                    placeholder="John Doe"
                    value={form.full_name}
                    onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Email address</label>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none transition focus:border-[#29d1c4] focus:bg-white focus:ring-2 focus:ring-[#29d1c4]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:focus:bg-slate-900"
                  placeholder="name@example.com"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>

              {/* Password & Confirm Password in a grid on larger screens */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Password</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 py-2.5 text-sm outline-none transition focus:border-[#29d1c4] focus:bg-white focus:ring-2 focus:ring-[#29d1c4]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:focus:bg-slate-900"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
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

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Confirm password</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 py-2.5 text-sm outline-none transition focus:border-[#29d1c4] focus:bg-white focus:ring-2 focus:ring-[#29d1c4]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:focus:bg-slate-900"
                      placeholder="••••••••"
                      type={showConfirmPassword ? "text" : "password"}
                      minLength={8}
                      value={form.confirm_password}
                      onChange={(event) => setForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-400"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
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
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600 dark:border-red-950/30 dark:bg-red-950/20 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                disabled={submitting}
                className="w-full mt-2 rounded-2xl bg-[#29d1c4] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-200/40 hover:opacity-95 transition disabled:cursor-not-allowed disabled:opacity-70 dark:shadow-none"
              >
                {submitting ? "Creating account..." : "Create account"}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Already have an account?</span>
              <Link className="font-semibold text-[#22b9ae] hover:text-[#1da79b] hover:underline" to="/login">
                Sign in
              </Link>
            </div>

          </div>
        </div>

        {/* Right Info Column (Visual) */}
        <div className="hidden flex-1 items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#2dd4bf] p-10 text-white lg:flex">
          <div className="max-w-xs rounded-[32px] border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path d="M4 17h16" />
                <path d="M7 13V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" />
                <path d="M8 17v-3h8v3" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Make every rupee count</h2>
            <p className="mt-3 text-xs leading-relaxed text-slate-200">
              See balances, automate recurring bills, and build better habits with a calm, clear dashboard.
            </p>
            <ul className="mt-6 space-y-3.5 text-xs text-slate-100">
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#29d1c4]" />
                Smart budgeting insights
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#29d1c4]" />
                Secure account access
              </li>
              <li className="flex items-center gap-2.5">
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
