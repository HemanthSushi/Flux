import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

function getErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.email?.[0] === "string") return data.email[0];
  return fallback;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const resp = await api.post("/auth/forgot-password/", { email });
      setSuccess(resp.data?.detail || "If the account exists, reset instructions were sent.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not process your request. Please try again."));
    } finally {
      setSubmitting(false);
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
                Forgot your password?
              </h1>

              <p className="text-base text-slate-600 dark:text-slate-300">
                Enter your email and we will send a verification link to reset your password.
              </p>

              <div>
                <label className="mb-2 block text-lg text-slate-600 dark:text-slate-300">Email</label>
                <input
                  type="email"
                  className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-base text-red-600">{error}</p>}
              {success && <p className="text-base text-emerald-700">{success}</p>}

              <button
                disabled={submitting}
                className="w-full rounded-[2px] bg-[#29d1c4] px-4 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Sending..." : "Send Reset Link"}
              </button>

              <p className="text-lg text-slate-700 dark:text-slate-300">
                Remembered your password?{" "}
                <Link className="font-semibold text-[#22b9ae]" to="/login">
                  Back to Login
                </Link>
              </p>
            </form>
          </div>
        </div>

        <div className="relative hidden min-h-[40vh] bg-[#fafafa] px-8 py-8 dark:bg-slate-900 sm:px-10 lg:block lg:min-h-screen">
          <div className="absolute right-5 top-5 flex items-center gap-2 text-xs font-semibold">
            <Link
              to="/login"
              className="rounded-[2px] px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Login
            </Link>
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
