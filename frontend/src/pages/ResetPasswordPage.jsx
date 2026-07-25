import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

function getErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.token?.[0] === "string") return data.token[0];
  if (typeof data?.new_password?.[0] === "string") return data.new_password[0];
  if (typeof data?.confirm_password?.[0] === "string") return data.confirm_password[0];
  return fallback;
}

export default function ResetPasswordPage() {
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [form, setForm] = useState({ new_password: "", confirm_password: "" });
  const [error, setError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryUid = params.get("uid") || "";
    const queryToken = params.get("token") || "";
    setUid(queryUid);
    setToken(queryToken);

    if (!queryUid || !queryToken) {
      setVerified(false);
      setTokenError("Reset link is incomplete. Request a new password reset email.");
      setVerifying(false);
      return;
    }

    let isMounted = true;

    const verifyToken = async () => {
      setVerifying(true);
      setTokenError("");
      try {
        await api.post("/auth/reset-password/verify/", { uid: queryUid, token: queryToken });
        if (isMounted) {
          setVerified(true);
        }
      } catch (err) {
        if (isMounted) {
          setVerified(false);
          setTokenError(getErrorMessage(err, "This reset link is invalid or expired."));
        }
      } finally {
        if (isMounted) {
          setVerifying(false);
        }
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!verified || !uid || !token) return;

    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const resp = await api.post("/auth/reset-password/", { uid, token, ...form });
      setSuccess(resp.data?.detail || "Password changed successfully.");
      setForm({ new_password: "", confirm_password: "" });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to reset password. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#e3edf5] dark:bg-slate-950">
      <div className="grid min-h-screen w-full overflow-hidden bg-white dark:bg-slate-900 lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-[#edf3f4] px-8 py-10 dark:bg-slate-800 sm:px-12 sm:py-12">
          <div className="w-full max-w-md pl-0 sm:pl-6 lg:pl-10">
            <img src="/icon-512-maskable.png" alt="Flux" className="mb-12 h-11 w-auto" />

            <div className="w-full max-w-sm space-y-5">
              <h1 className="text-3xl font-semibold leading-tight text-slate-800 dark:text-slate-100 sm:text-4xl">
                Reset password
              </h1>

              {verifying && <p className="text-base text-slate-600 dark:text-slate-300">Verifying reset link...</p>}

              {!verifying && tokenError && (
                <div className="space-y-3">
                  <p className="text-base text-red-600">{tokenError}</p>
                  <Link className="text-sm font-semibold text-[#22b9ae]" to="/forgot-password">
                    Request a new reset link
                  </Link>
                </div>
              )}

              {!verifying && verified && !success && (
                <form onSubmit={onSubmit} className="space-y-5">
                  <p className="text-base text-slate-600 dark:text-slate-300">
                    Set your new password below. Password must be at least 8 characters.
                  </p>

                  <div>
                    <label className="mb-2 block text-lg text-slate-600 dark:text-slate-300">New password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        minLength={8}
                        className="w-full rounded-[2px] border border-slate-200 bg-white pl-4 pr-12 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                        value={form.new_password}
                        onChange={(e) => setForm((prev) => ({ ...prev, new_password: e.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-400"
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? (
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
                    <label className="mb-2 block text-lg text-slate-600 dark:text-slate-300">Confirm password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        minLength={8}
                        className="w-full rounded-[2px] border border-slate-200 bg-white pl-4 pr-12 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                        value={form.confirm_password}
                        onChange={(e) => setForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-400"
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

                  {error && <p className="text-base text-red-600">{error}</p>}

                  <button
                    disabled={submitting}
                    className="w-full rounded-[2px] bg-[#29d1c4] px-4 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? "Saving..." : "Change Password"}
                  </button>
                </form>
              )}

              {success && (
                <div className="space-y-3">
                  <p className="text-base text-emerald-700">{success}</p>
                  <Link className="text-sm font-semibold text-[#22b9ae]" to="/login">
                    Go to Login
                  </Link>
                </div>
              )}
            </div>
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
            <img src="/icon-512-maskable.png" alt="Flux" className="h-40 w-auto sm:h-44" />
          </div>
        </div>
      </div>
    </div>
  );
}
