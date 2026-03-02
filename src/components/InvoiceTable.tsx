// src/components/InvoiceTable.tsx
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices } from "../hooks/useInvoices";
import { Search, X, ChevronRight, FileSearch } from "lucide-react";
import { Skeleton } from "./ui/Skeleton";
import { calculateBillingMetrics } from "../utils/billingCalculations";
import type { Invoice } from "../types/invoice";
import { useAmountDisplayStore } from "../store/useAmountDisplayStore";

type StatusFilter = "all" | "overdue" | "unpaid" | "paid";
type DatePreset = "all" | "30" | "90" | "365";

const statusConfig: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  overdue: {
    label: "Forfalden",
    dot: "bg-rose-500",
    badge:
      "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:ring-rose-900",
  },
  paid: {
    label: "Betalt",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-900",
  },
  unpaid: {
    label: "Ubetalt",
    dot: "bg-amber-500",
    badge:
      "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-900",
  },
};

const getStatusConfig = (status: string) =>
  statusConfig[status.toLowerCase()] ?? {
    label: status,
    dot: "bg-slate-400",
    badge: "bg-slate-50 text-slate-600 ring-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
  };

export const InvoiceTable = () => {
  const { data: invoices, isLoading, isError } = useInvoices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const amountDisplayMode = useAmountDisplayStore((state) => state.mode);
  const navigate = useNavigate();

  const formatCurrency = (val: number) =>
    val.toLocaleString("da-DK", { style: "currency", currency: "DKK" });

  const matchesStatus = useCallback(
    (status: string) => {
      if (statusFilter === "all") return true;
      return status.toLowerCase() === statusFilter;
    },
    [statusFilter],
  );

  const matchesDatePreset = useCallback(
    (invoice: Invoice, now: Date) => {
      if (datePreset === "all") return true;
      const postingDate = new Date(invoice.postingDate);
      const diffDays =
        (now.getTime() - postingDate.getTime()) / (1000 * 60 * 60 * 24);
      if (datePreset === "30") return diffDays <= 30;
      if (datePreset === "90") return diffDays <= 90;
      if (datePreset === "365") return diffDays <= 365;
      return true;
    },
    [datePreset],
  );

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    const now = new Date();
    return invoices
      .filter((inv) =>
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()),
      )
      .filter((inv) => matchesStatus(inv.status))
      .filter((inv) => matchesDatePreset(inv, now));
  }, [invoices, search, matchesStatus, matchesDatePreset]);

  const metrics = calculateBillingMetrics(filteredInvoices);
  const metricsExclVat = calculateBillingMetrics(filteredInvoices, "exclVat");
  const amountColumnLabel =
    amountDisplayMode === "both"
      ? "Beløb"
      : amountDisplayMode === "exclVat"
        ? "Beløb ekskl. moms"
        : "Beløb inkl. moms";
  const totalRows = filteredInvoices.length;

  if (isLoading)
    return (
      <div className="space-y-3 px-6 py-5">
        {[...Array(6)].map((_, idx) => (
          <div key={idx} className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="ml-auto h-4 w-32" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
        ))}
      </div>
    );

  if (isError)
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/60">
          <FileSearch className="h-5 w-5 text-rose-500" />
        </span>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Kunne ikke hente fakturadata
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tjek din forbindelse og prøv igen.
        </p>
      </div>
    );

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Alle" },
    { value: "overdue", label: "Forfalden" },
    { value: "unpaid", label: "Ubetalt" },
    { value: "paid", label: "Betalt" },
  ];

  const datePresetOptions: { value: DatePreset; label: string }[] = [
    { value: "all", label: "Hele perioden" },
    { value: "30", label: "Seneste 30 dage" },
    { value: "90", label: "Seneste 90 dage" },
    { value: "365", label: "Seneste år" },
  ];

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="space-y-4 px-6 py-4">
        {/* Row 1: Search + date preset */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-700"
              placeholder="Søg fakturanummer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Søg fakturanummer"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Ryd søgning"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Date preset */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="datePreset"
              className="text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Periode
            </label>
            <select
              id="datePreset"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {datePresetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Status filter chips */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filtrer efter status"
        >
          {statusFilters.map((option) => {
            const cfg = statusConfig[option.value];
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  isActive
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {cfg && option.value !== "all" && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${!isActive ? "opacity-60" : ""}`}
                    aria-hidden
                  />
                )}
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Row 3: Summary stats */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-slate-50 px-4 py-2.5 text-xs dark:bg-slate-800/60">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {totalRows}{" "}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              {totalRows === 1 ? "faktura" : "fakturaer"}
            </span>
          </span>
          {amountDisplayMode === "both" ? (
            <>
              <span className="text-slate-500 dark:text-slate-400">
                Åben saldo{" "}
                <span className="font-semibold tabular text-slate-700 dark:text-slate-300">
                  {formatCurrency(metrics.balanceDue)}
                </span>{" "}
                /{" "}
                <span className="font-semibold tabular text-slate-700 dark:text-slate-300">
                  {formatCurrency(metricsExclVat.balanceDue)}
                </span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Gns.{" "}
                <span className="font-semibold tabular text-slate-700 dark:text-slate-300">
                  {formatCurrency(metrics.averageInvoice)}
                </span>{" "}
                /{" "}
                <span className="font-semibold tabular text-slate-700 dark:text-slate-300">
                  {formatCurrency(metricsExclVat.averageInvoice)}
                </span>
              </span>
            </>
          ) : amountDisplayMode === "exclVat" ? (
            <>
              <span className="text-slate-500 dark:text-slate-400">
                Åben saldo{" "}
                <span className="font-semibold tabular text-slate-700 dark:text-slate-300">
                  {formatCurrency(metricsExclVat.balanceDue)}
                </span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Gns.{" "}
                <span className="font-semibold tabular text-slate-700 dark:text-slate-300">
                  {formatCurrency(metricsExclVat.averageInvoice)}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-500 dark:text-slate-400">
                Åben saldo{" "}
                <span className="font-semibold tabular text-slate-700 dark:text-slate-300">
                  {formatCurrency(metrics.balanceDue)}
                </span>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Gns.{" "}
                <span className="font-semibold tabular text-slate-700 dark:text-slate-300">
                  {formatCurrency(metrics.averageInvoice)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto scrollbar-thin border-t border-slate-100 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/50">
              <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Faktura nr.
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Dato
              </th>
              <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Status
              </th>
              <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {amountColumnLabel}
              </th>
              <th className="w-8 px-4 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredInvoices.map((invoice) => {
              const cfg = getStatusConfig(invoice.status);
              return (
                <tr
                  key={invoice.invoiceNumber}
                  onClick={() => navigate(`/invoices/${invoice.invoiceNumber}`)}
                  className="group cursor-pointer transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                >
                  <td className="px-6 py-3.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {invoice.invoiceNumber}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="tabular text-xs text-slate-500 dark:text-slate-400">
                      {new Date(invoice.postingDate).toLocaleDateString(
                        "da-DK",
                        { day: "2-digit", month: "short", year: "numeric" },
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cfg.badge}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`}
                        aria-hidden
                      />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {amountDisplayMode === "both" ? (
                      <div className="tabular">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(invoice.amountInclVat)}{" "}
                          <span className="text-[10px] font-normal text-slate-400">
                            inkl.
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatCurrency(invoice.amount)}{" "}
                          <span className="text-[10px]">ekskl.</span>
                        </div>
                      </div>
                    ) : amountDisplayMode === "exclVat" ? (
                      <span className="tabular text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(invoice.amount)}
                      </span>
                    ) : (
                      <span className="tabular text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(invoice.amountInclVat)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-500 dark:text-slate-600 dark:group-hover:text-blue-400" />
                  </td>
                </tr>
              );
            })}

            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <FileSearch className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                    </span>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Ingen fakturaer matcher dine filtre
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Prøv at justere søgning eller datointerval.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

