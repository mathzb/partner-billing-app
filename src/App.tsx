// src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";

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

const queryClient = new QueryClient();

const apiStatusBadgeConfig: Record<
  ApiHealthStatus,
  { label: string; pillClass: string; dotClass: string }
> = {
  connected: {
    label: "Billing API forbundet",
    pillClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  disconnected: {
    label: "Billing API utilgængelig",
    pillClass: "border-rose-500/40 bg-rose-500/10 text-rose-700",
    dotClass: "bg-rose-500 animate-pulse",
  },
  unknown: {
    label: "Billing API status ukendt",
    pillClass: "border-slate-300 bg-white text-slate-500",
    dotClass: "bg-slate-400",
  },
};

const amountDisplayOptions: Array<{ value: AmountDisplayMode; label: string }> =
  [
    { value: "inclVat", label: "Inkl. moms" },
    { value: "exclVat", label: "Ekskl. moms" },
    { value: "both", label: "Begge" },
  ];

function DashboardPage() {
  return (
    <div className="space-y-6">
      <BillingSummary />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              Fakturaer
            </h2>
            <p className="text-xs text-slate-500">
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
  const statusBadge =
    apiStatusBadgeConfig[apiStatus] ?? apiStatusBadgeConfig.unknown;

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen bg-slate-100">
        <main className="ml-0 flex-1 px-4 py-6 scrollbar-thin sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Link to="/" className="inline-flex items-baseline gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Overblik over partnerfakturering
                  </h1>
                </Link>
              </div>
              <div>
                <p className="mt-1 text-sm text-slate-500">
                  Automatiseret fakturahåndtering for partner{" "}
                  <span className="font-mono text-slate-700">ipnordic A/S</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1 text-xs font-medium text-slate-600">
                    {amountDisplayOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAmountDisplayMode(option.value)}
                        className={`rounded-full px-2.5 py-1 transition-colors ${
                          amountDisplayMode === option.value
                            ? "bg-slate-900 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span
                    role="status"
                    aria-live="polite"
                    data-api-status={apiStatus}
                    className={`hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium sm:inline-flex ${statusBadge.pillClass}`}
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${statusBadge.dotClass}`}
                      aria-hidden="true"
                    />
                    {statusBadge.label}
                  </span>
                </div>
              </div>
            </header>

            {authError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
              >
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
      </div>
    </QueryClientProvider>
  );
}
