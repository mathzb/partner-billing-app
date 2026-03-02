// src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import { Moon, Sun, Building2 } from "lucide-react";

import { BillingSummary } from "./components/BillingSummary";
import { InvoiceTable } from "./components/InvoiceTable";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage";
import {
  useApiHealthStore,
  type ApiHealthStatus,
} from "./store/useApiHealthStore";
import {
  useAmountDisplayStore,
  type AmountDisplayMode,
} from "./store/useAmountDisplayStore";
import { useAuthStore } from "./store/useAuthStore";
import { useDarkModeStore } from "./store/useDarkModeStore";

const queryClient = new QueryClient();

const apiStatusConfig: Record<
  ApiHealthStatus,
  { label: string; dot: string; badge: string }
> = {
  connected: {
    label: "API online",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
  disconnected: {
    label: "API offline",
    dot: "bg-rose-500 animate-pulse",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-400",
  },
  unknown: {
    label: "API ukendt",
    dot: "bg-slate-400",
    badge:
      "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
  },
};

const amountDisplayOptions: Array<{ value: AmountDisplayMode; label: string }> =
  [
    { value: "inclVat", label: "Inkl." },
    { value: "exclVat", label: "Ekskl." },
    { value: "both", label: "Begge" },
  ];

function DashboardPage() {
  return (
    <div className="space-y-6">
      <BillingSummary />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Fakturaer
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Gennemse og filtrér partnerfakturaer fra Cloud Factory API.
            </p>
          </div>
        </div>
        <InvoiceTable />
      </section>
    </div>
  );
}

export default function App() {
  const apiStatus = useApiHealthStore((state) => state.status);
  const authError = useAuthStore((state) => state.authError);
  const amountDisplayMode = useAmountDisplayStore((state) => state.mode);
  const setAmountDisplayMode = useAmountDisplayStore((state) => state.setMode);
  const { isDark, toggle: toggleDark } = useDarkModeStore();
  const statusCfg = apiStatusConfig[apiStatus] ?? apiStatusConfig.unknown;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
        {/* ── Top navigation bar ── */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            {/* Brand */}
            <Link
              to="/"
              className="mr-auto flex items-center gap-2.5 rounded-lg p-1 transition-opacity hover:opacity-80"
              aria-label="Gå til oversigt"
            >
              <span className="hidden text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:block">
                Overblik over CF Fakturering
              </span>
            </Link>

            {/* Company pill */}
            <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:flex">
              <Building2 className="h-3 w-3 text-slate-400" aria-hidden />
              ipnordic A/S
            </div>

            {/* VAT toggle */}
            <div
              className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800"
              role="group"
              aria-label="Vis beløb"
            >
              {amountDisplayOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAmountDisplayMode(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    amountDisplayMode === opt.value
                      ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* API status */}
            <span
              role="status"
              aria-live="polite"
              data-api-status={apiStatus}
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${statusCfg.badge}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`}
                aria-hidden
              />
              {statusCfg.label}
            </span>

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={toggleDark}
              aria-label={
                isDark ? "Skift til lyst tema" : "Skift til mørkt tema"
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="flex-1 px-4 py-8 scrollbar-thin sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            {authError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              >
                <span className="mt-0.5 text-rose-500">⚠</span>
                {authError}
              </div>
            )}

            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route
                path="/invoices/:invoiceNo"
                element={<InvoiceDetailPage />}
              />
            </Routes>
          </div>
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between text-[11px] text-slate-400 dark:text-slate-600">
            <span>Partner Billing — ipnordic A/S</span>
            <span>Cloud Factory Billing API</span>
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  );
}
