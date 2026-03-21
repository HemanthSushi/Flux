import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen w-full bg-[#e3edf5] dark:bg-slate-950">
      <div className="grid min-h-screen w-full overflow-hidden bg-white dark:bg-slate-900 lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-[#edf3f4] px-8 py-10 dark:bg-slate-800 sm:px-12 sm:py-12">
          <div className="w-full max-w-md pl-0 sm:pl-6 lg:pl-10">
            <img src="/logo.svg" alt="Money Diary" className="mb-12 h-11 w-auto" />

            <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
              <h1 className="text-3xl font-semibold leading-tight text-slate-800 dark:text-slate-100 sm:text-4xl">
              Login with username and password
              </h1>

              <div>
                <label className="mb-2 block text-lg text-slate-600 dark:text-slate-300">Username</label>
                <input
                  className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  required
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-lg text-slate-600 dark:text-slate-300">Password</label>
                  <Link className="text-sm font-semibold text-[#22b9ae]" to="/forgot-password">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 pr-12 text-lg dark:border-slate-600 dark:bg-slate-900"
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12c.92-2.61 2.64-4.83 4.94-6.36" />
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <path d="M1 1l22 22" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(e) => setForm((p) => ({ ...p, remember: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-[#22b9ae] focus:ring-[#22b9ae]"
                />
                Remember me
              </label>

              {error && <p className="text-base text-red-600">{error}</p>}

              <button className="w-full rounded-[2px] bg-[#29d1c4] px-4 py-3 text-lg font-semibold text-white">
                Login
              </button>

              <p className="text-lg text-slate-700 dark:text-slate-300">
                No account?{" "}
                <Link className="font-semibold text-[#22b9ae]" to="/register">
                  Create User
                </Link>
              </p>
            </form>
          </div>
        </div>

        <div className="relative hidden min-h-[40vh] bg-[#fafafa] px-8 py-8 dark:bg-slate-900 sm:px-10 lg:block lg:min-h-screen">
          <div className="absolute right-5 top-5 flex items-center gap-2 text-xs font-semibold">
            <span className="rounded-[2px] px-3 py-2 text-slate-700 dark:text-slate-200">Login</span>
            <Link
              to="/register"
              className="rounded-[2px] bg-[#29d1c4] px-4 py-2 text-white hover:opacity-90"
            >
              Create User
            </Link>
          </div>

          <div className="grid h-full place-items-center">
            <img src="/logo.svg" alt="Money Diary" className="h-40 w-auto sm:h-44" />
          </div>
        </div>
      </div>
    </div>
  );
}
