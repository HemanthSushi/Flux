import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const VERIFY_GENERIC_MESSAGE = "If an account with this email exists, a verification code has been sent.";

function extractErrorMessage(error, fallback = "Registration failed. Please verify all fields and try again.") {
  const data = error?.response?.data;
  if (!data) return "Registration failed. Check backend server and try again.";

  if (typeof data.detail === "string") return data.detail;
  if (typeof data.username?.[0] === "string") return `Username: ${data.username[0]}`;
  if (typeof data.password?.[0] === "string") return `Password: ${data.password[0]}`;
  if (typeof data.confirm_password?.[0] === "string") return `Confirm password: ${data.confirm_password[0]}`;
  if (typeof data.email?.[0] === "string") return `Email: ${data.email[0]}`;
  if (typeof data.token?.[0] === "string") return data.token[0];
  if (typeof data.non_field_errors?.[0] === "string") return data.non_field_errors[0];
  if (typeof data === "object") return `Request failed: ${JSON.stringify(data)}`;

  return fallback;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12c.92-2.61 2.64-4.83 4.94-6.36" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function getPasswordStrength(password) {
  if (!password) {
    return { score: 0, label: "Not set", color: "#94a3b8" };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: "Weak", color: "#ef4444" };
  if (score === 3) return { score, label: "Fair", color: "#f59e0b" };
  if (score === 4) return { score, label: "Good", color: "#0ea5e9" };
  return { score, label: "Strong", color: "#10b981" };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("form");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verifyingLink, setVerifyingLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    full_name: "",
    currency: "USD"
  });

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const progressStep = step === "form" ? 1 : step === "pending" ? 2 : 3;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid") || "";
    const token = params.get("token") || "";
    if (!uid || !token) return;

    let isMounted = true;

    const verifyToken = async () => {
      setStep("pending");
      setVerifyingLink(true);
      setError("");
      setInfo("Verifying your email link...");
      try {
        const response = await api.post("/auth/email-verify/confirm/", { uid, token });
        if (isMounted) {
          setStep("verified");
          setInfo(response.data?.detail || "Email verified successfully. You can login now.");
        }
      } catch (err) {
        if (isMounted) {
          setStep("pending");
          setError(
            extractErrorMessage(err, "This verification link is invalid or expired. Please request a new one.")
          );
          setInfo("");
        }
      } finally {
        if (isMounted) {
          setVerifyingLink(false);
        }
      }
    };

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, []);

  const requestVerificationEmail = async (email) => {
    const response = await api.post("/auth/email-verify/request-public/", { email });
    return response.data?.detail || VERIFY_GENERIC_MESSAGE;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (form.password !== form.confirm_password) {
      setError("Confirm password does not match.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        currency: form.currency
      };
      await register(payload);
      setStep("pending");
      setVerificationEmail(form.email);
      setOtp("");
      try {
        const message = await requestVerificationEmail(form.email);
        setInfo(message);
      } catch (err) {
        setInfo("Account created. Use resend below to send a verification code.");
        setError(
          extractErrorMessage(err, "Account created, but verification code could not be sent. Please resend.")
        );
      }
      setForm((prev) => ({ ...prev, password: "", confirm_password: "" }));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onResendVerification = async () => {
    const email = verificationEmail.trim();
    if (!email) {
      setError("Enter your email to resend verification.");
      return;
    }

    setResending(true);
    setError("");
    try {
      const message = await requestVerificationEmail(email);
      setInfo(message);
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to resend verification email. Please try again."));
    } finally {
      setResending(false);
    }
  };

  const onVerifyOtp = async () => {
    const email = verificationEmail.trim();
    const code = otp.trim();

    if (!email) {
      setError("Enter your verification email.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit OTP code from your email.");
      return;
    }

    setVerifyingOtp(true);
    setError("");
    setInfo("");
    try {
      const response = await api.post("/auth/email-verify/confirm-otp/", { email, otp: code });
      setStep("verified");
      setInfo(response.data?.detail || "Email verified successfully. You can login now.");
      setOtp("");
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to verify OTP. Please check the code and try again."));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const onStartNewRegistration = () => {
    setStep("form");
    setError("");
    setInfo("");
    setVerificationEmail("");
    setOtp("");
    setForm({
      username: "",
      email: "",
      password: "",
      confirm_password: "",
      full_name: "",
      currency: "USD"
    });
    window.history.replaceState({}, "", "/register");
  };

  return (
    <div className="min-h-screen w-full bg-[#e3edf5] dark:bg-slate-950">
      <div className="grid min-h-screen w-full overflow-hidden bg-white dark:bg-slate-900 lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-[#edf3f4] px-8 py-10 dark:bg-slate-800 sm:px-12 sm:py-12">
          <div className="w-full max-w-md pl-0 sm:pl-6 lg:pl-10">
            <img src="/logo.svg" alt="Money Diary" className="mb-8 h-11 w-auto" />

            <div className="w-full max-w-sm space-y-4">
              <h1 className="text-3xl font-semibold text-slate-800 dark:text-slate-100 sm:text-4xl">
                Create secure account
              </h1>

              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                <div
                  className={`rounded-[2px] px-2 py-2 text-center ${
                    progressStep >= 1
                      ? "bg-[#29d1c4] text-white"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  1. Details
                </div>
                <div
                  className={`rounded-[2px] px-2 py-2 text-center ${
                    progressStep >= 2
                      ? "bg-[#29d1c4] text-white"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  2. Verify
                </div>
                <div
                  className={`rounded-[2px] px-2 py-2 text-center ${
                    progressStep >= 3
                      ? "bg-[#29d1c4] text-white"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  3. Login
                </div>
              </div>

              {step === "form" ? (
                <form onSubmit={onSubmit} className="space-y-4">
                  <input
                    className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                    placeholder="Username"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    required
                  />
                  <input
                    className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                    placeholder="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                  <input
                    className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                    placeholder="Full name"
                    value={form.full_name}
                    onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  />

                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 pr-12 text-lg dark:border-slate-600 dark:bg-slate-900"
                        placeholder="Password"
                        type={showPassword ? "text" : "password"}
                        minLength={8}
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
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>Password strength</span>
                        <span>{passwordStrength.label}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${passwordStrength.score * 20}%`,
                            backgroundColor: passwordStrength.color
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 pr-12 text-lg dark:border-slate-600 dark:bg-slate-900"
                      placeholder="Confirm password"
                      type={showConfirmPassword ? "text" : "password"}
                      minLength={8}
                      value={form.confirm_password}
                      onChange={(e) => setForm((p) => ({ ...p, confirm_password: e.target.value }))}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>

                  <select
                    className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                    value={form.currency}
                    onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="INR">INR</option>
                    <option value="GBP">GBP</option>
                  </select>

                  {error && <p className="text-base text-red-600">{error}</p>}
                  {info && <p className="text-base text-emerald-700">{info}</p>}

                  <button
                    disabled={submitting}
                    className="w-full rounded-[2px] bg-[#29d1c4] px-4 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? "Creating..." : "Create Account & Send Verification"}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-base text-slate-700 dark:text-slate-200">
                    Your account is created. Enter the OTP sent to your email to complete verification.
                  </p>

                  {verifyingLink && <p className="text-base text-slate-600 dark:text-slate-300">Verifying link...</p>}
                  {error && <p className="text-base text-red-600">{error}</p>}
                  {info && <p className="text-base text-emerald-700">{info}</p>}

                  {step === "pending" && (
                    <>
                      <input
                        className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg dark:border-slate-600 dark:bg-slate-900"
                        placeholder="Verification email"
                        type="email"
                        value={verificationEmail}
                        onChange={(e) => setVerificationEmail(e.target.value)}
                      />
                      <input
                        className="w-full rounded-[2px] border border-slate-200 bg-white px-4 py-3 text-lg tracking-[0.25em] dark:border-slate-600 dark:bg-slate-900"
                        placeholder="Enter 6-digit OTP"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      />

                      <button
                        type="button"
                        onClick={onVerifyOtp}
                        disabled={verifyingOtp}
                        className="w-full rounded-[2px] bg-[#22b9ae] px-4 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {verifyingOtp ? "Verifying..." : "Verify OTP"}
                      </button>

                      <button
                        type="button"
                        onClick={onResendVerification}
                        disabled={resending}
                        className="w-full rounded-[2px] bg-[#29d1c4] px-4 py-3 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {resending ? "Sending..." : "Resend OTP"}
                      </button>
                    </>
                  )}

                  {step === "verified" && (
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="w-full rounded-[2px] bg-[#29d1c4] px-4 py-3 text-lg font-semibold text-white"
                    >
                      Continue to Login
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onStartNewRegistration}
                    className="w-full rounded-[2px] border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Start New Registration
                  </button>
                </div>
              )}

              <p className="text-lg text-slate-700 dark:text-slate-300">
                Already have an account?{" "}
                <Link className="font-semibold text-[#22b9ae]" to="/login">
                  Login
                </Link>
              </p>
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
            <span className="rounded-[2px] bg-[#29d1c4] px-4 py-2 text-white">Create User</span>
          </div>

          <div className="grid h-full place-items-center">
            <img src="/logo.svg" alt="Money Diary" className="h-40 w-auto sm:h-44" />
          </div>
        </div>
      </div>
    </div>
  );
}
