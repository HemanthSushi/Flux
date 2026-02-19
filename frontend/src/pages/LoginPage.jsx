import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(form.username, form.password);
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
                <input
                  type="password"
                  className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  required
                />
              </div>

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
