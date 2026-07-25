import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProfileMenu from "./ProfileMenu";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { 
    to: "/", 
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    )
  },
  { 
    to: "/wallets", 
    label: "Wallets",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    )
  },
  { 
    to: "/transactions", 
    label: "Transactions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M16 3h5v5M4 21L21 4M4 21h5v-5" />
      </svg>
    )
  },
  { 
    to: "/recurring", 
    label: "Recurring",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
      </svg>
    )
  },
  { 
    to: "/budgets", 
    label: "Budgets",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    )
  },
  { 
    to: "/goals", 
    label: "Goals",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    )
  },
  { 
    to: "/reports", 
    label: "Reports",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z" />
      </svg>
    )
  }
];

const tourSteps = [
  {
    target: "#tour-logo",
    title: "Welcome to Flux 🚀",
    text: "Flux is your premium, AI-powered financial ledger. Let's take a quick 1-minute tour of the key areas."
  },
  {
    target: "#tour-nav",
    title: "Sidebar Navigation 🧭",
    text: "Use this panel to manage cash Wallets, Transaction ledgers, Recurring invoices, Budgets, and custom PDF/CSV Reports."
  },
  {
    target: "#tour-stats",
    title: "Real-time Metrics 📊",
    text: "Get instant analytics of your total monthly Income, Expenses, and calculated Net Savings at a glance."
  },
  {
    target: "#tour-charts",
    title: "Interactive Charts 📈",
    text: "Dissect your exact category distribution and flow comparisons using clean visual representations."
  },
  {
    target: "#tour-recent",
    title: "Recent Entries 🧾",
    text: "Review your recent activity ledger logs, transaction types, dates, and origin accounts directly."
  },
  {
    target: "#tour-top-spending",
    title: "Top Categories 🔥",
    text: "Instantly see which categories consume the most funds to help optimize your monthly outlays."
  }
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [helpOpen, setHelpOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [openFaq, setOpenFaq] = useState({});

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  const cleanTourHighlights = () => {
    document.querySelectorAll(".tour-highlight").forEach((el) => {
      el.classList.remove("tour-highlight");
    });
  };

  const startTour = () => {
    setHelpOpen(false);
    navigate("/");
    setTimeout(() => {
      setTourActive(true);
      setTourStep(0);
    }, 450);
  };

  const nextStep = () => {
    if (tourStep < tourSteps.length - 1) {
      setTourStep((p) => p + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (tourStep > 0) {
      setTourStep((p) => p - 1);
    }
  };

  const endTour = () => {
    setTourActive(false);
    cleanTourHighlights();
    localStorage.setItem("flux_tour_completed", "true");
  };

  useEffect(() => {
    cleanTourHighlights();
    if (tourActive && tourStep < tourSteps.length) {
      const step = tourSteps[tourStep];
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        targetEl.classList.add("tour-highlight");
      }
    }
    return () => cleanTourHighlights();
  }, [tourActive, tourStep]);

  useEffect(() => {
    if (user && !localStorage.getItem("flux_tour_completed")) {
      const timer = setTimeout(() => {
        startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const toggleFaq = (idx) => {
    setOpenFaq((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const faqItems = [
    {
      q: "How does the AI Receipt Scan work?",
      a: "Upload any receipt (PNG, JPG, PDF) in Transactions. Our OCR parser reads the text, extracts the date, amounts, and suggests categories to automatically populate the forms."
    },
    {
      q: "How do I configure monthly budgets?",
      a: "Go to Budgets. You can define a total limit for the month, and set custom category-specific budget limits to track overspending."
    },
    {
      q: "What are Recurring Transactions?",
      a: "Set up automated repeating schedules (e.g. daily, weekly, monthly rent, utility bills). Django automatically checks and applies them on their due dates."
    },
    {
      q: "Can I manage multiple wallets?",
      a: "Yes, you can configure cash accounts, bank accounts, and credit card profiles in Wallets, letting you track different balances independently."
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full ambient-glow-1 animate-pulse-glow pointer-events-none" />
      <div className="absolute right-10 top-20 h-[30rem] w-[30rem] rounded-full ambient-glow-2 animate-pulse-glow pointer-events-none" />
      <div className="absolute left-[30%] bottom-0 h-96 w-96 rounded-full ambient-glow-1 animate-pulse-glow pointer-events-none" />

      <header className="sticky top-0 z-20 border-b border-slate-200/40 bg-white/40 backdrop-blur-md dark:border-slate-800/40 dark:bg-slate-950/45">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <Link id="tour-logo" to="/" className="flex items-center transition hover:opacity-85">
            <img src="/icon-512-maskable.png" alt="Flux logo" className="h-10 w-auto sm:h-11" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <ProfileMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[240px_minmax(0,1fr)] relative z-10">
        <aside id="tour-nav" className="overflow-x-auto rounded-2xl glass-panel p-2.5 lg:h-fit lg:p-4">
          <p className="mb-4 hidden px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 lg:block">
            {user?.full_name || user?.username}
          </p>
          <nav className="flex items-center gap-1.5 lg:block lg:space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white shadow-md shadow-[#29d1c4]/20"
                      : "hover:bg-slate-200/50 hover:pl-5 dark:hover:bg-slate-800/50"
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 animate-fade-in-up flex flex-col justify-between min-h-[calc(100vh-140px)] sm:min-h-[calc(100vh-160px)] lg:min-h-[calc(100vh-180px)]">
          <div className="flex-1 pb-8">{children}</div>
          
          {/* Subtle Page Watermark */}
          <div className="mt-8 border-t border-slate-200/20 dark:border-slate-800/15 pt-4 flex flex-col items-center justify-center select-none pointer-events-none opacity-20 dark:opacity-10">
            <span className="font-heading text-lg font-black tracking-[0.25em] text-slate-400 dark:text-slate-500 uppercase pl-[0.25em]">Flux</span>
            <div className="flex items-center gap-1 font-heading text-[10px] font-extrabold tracking-[0.2em] text-slate-450 dark:text-slate-500 uppercase mt-0.5 pl-[0.2em]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5 text-[#29d1c4]">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>HS Builds</span>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Help toggle button */}
      <button
        id="tour-help"
        onClick={() => setHelpOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#29d1c4] to-[#1da79b] text-white shadow-lg shadow-[#29d1c4]/30 hover:scale-105 active:scale-95 transition-all duration-300 hover:shadow-glow-teal"
        title="Open Help Center"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {/* Slide-out Help drawer menu */}
      {helpOpen && (
        <>
          <div
            onClick={() => setHelpOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity duration-300"
          />
          <div className="fixed right-0 top-0 z-50 h-full w-[340px] max-w-full glass-panel shadow-2xl p-6 overflow-y-auto flex flex-col justify-between border-l border-white/10 animate-fade-in-up">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60 pb-4">
                <div>
                  <h3 className="font-heading text-lg font-extrabold text-slate-800 dark:text-slate-100">Help & Center</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">Flux User Support</p>
                </div>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="rounded-xl bg-white/50 dark:bg-slate-950/40 p-4 border border-white/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500 mb-2">Guided Walkthrough</h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">Let us show you around the analytics charts, scanners, wallet inputs, and ledger lists.</p>
                <button
                  onClick={startTour}
                  className="w-full rounded-xl bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white font-bold text-xs py-2.5 shadow-md shadow-[#29d1c4]/15 hover:shadow-glow-teal active:scale-95 transition-all duration-300"
                >
                  Start Guided Tour
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-455 dark:text-slate-500">Frequently Asked Questions</h4>
                <div className="space-y-2">
                  {faqItems.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white/30 dark:bg-slate-900/10 overflow-hidden">
                      <button
                        onClick={() => toggleFaq(idx)}
                        className="w-full flex items-center justify-between text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-slate-950/20 transition-all duration-200"
                      >
                        <span>{item.q}</span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className={`h-3 w-3 transform transition-transform duration-300 ${openFaq[idx] ? 'rotate-180' : ''}`}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {openFaq[idx] && (
                        <p className="px-3.5 pb-3 text-xs leading-relaxed text-slate-450 dark:text-slate-400 border-t border-slate-100/40 dark:border-slate-800/20 pt-2 animate-fade-in-up">
                          {item.a}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/50 dark:border-slate-800/60 pt-4 text-center">
              <p className="text-[10px] text-slate-400">Flux Ledger v1.0.0 | Created by Team</p>
            </div>
          </div>
        </>
      )}

      {/* Guided Walkthrough Tour Dialog Popover */}
      {tourActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm glass-panel p-5 shadow-2xl border border-white/20 animate-fade-in-up">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className="font-heading text-sm font-extrabold text-slate-850 dark:text-slate-100">
              {tourSteps[tourStep].title}
            </h4>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold text-slate-500">
              {tourStep + 1} / {tourSteps.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed mb-4">
            {tourSteps[tourStep].text}
          </p>
          <div className="flex items-center justify-between border-t border-slate-100/60 dark:border-slate-800/40 pt-3">
            <button
              onClick={endTour}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              Skip
            </button>
            <div className="flex gap-2">
              <button
                onClick={prevStep}
                disabled={tourStep === 0}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-905 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-200"
              >
                Back
              </button>
              <button
                onClick={nextStep}
                className="rounded-xl bg-gradient-to-r from-[#29d1c4] to-[#1da79b] text-white font-bold text-xs px-4 py-1.5 shadow-md shadow-[#29d1c4]/15 hover:shadow-glow-teal active:scale-95 transition-all duration-300"
              >
                {tourStep === tourSteps.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
