// src/components/InvoiceTable.tsx
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices } from "../hooks/useInvoices";
import { Search } from "lucide-react";
import { Skeleton } from "./ui/Skeleton";
import { calculateBillingMetrics } from "../utils/billingCalculations";
import type { Invoice } from "../types/invoice";

type StatusFilter = "all" | "overdue" | "unpaid" | "paid";
type DatePreset = "all" | "30" | "90" | "365";

export const InvoiceTable = () => {
  const { data: invoices, isLoading, isError } = useInvoices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const navigate = useNavigate();

  const formatCurrency = (val: number) =>
    val.toLocaleString("da-DK", { style: "currency", currency: "DKK" });

  const statusLabelMap: Record<string, string> = {
    overdue: "Forfalden",
    unpaid: "Ubetalt",
    paid: "Betalt",
  };

  const getStatusLabel = (status: string) =>
    statusLabelMap[status.toLowerCase()] ?? status;

  const matchesStatus = useCallback(
    (status: string) => {
      if (statusFilter === "all") return true;
      const normalized = status.toLowerCase();
      return normalized === statusFilter;
    },
    [statusFilter],
  );

  const matchesDatePreset = useCallback(
    (invoice: Invoice, now: Date) => {
      if (datePreset === "all") return true;
      const postingDate = new Date(invoice.postingDate);
      const diffMs = now.getTime() - postingDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
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
  const totalRows = filteredInvoices.length;

  if (isLoading)
    return (
      <div className="space-y-2 px-6 py-4">
        {[...Array(5)].map((_, idx) => (
          <div key={idx} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="ml-auto h-4 w-28" />
          </div>
        ))}
      </div>
    );

  if (isError)
    return (
      <div className="px-6 py-10 text-center text-sm text-red-500">
        Kunne ikke hente fakturadata.
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
    { value: "365", label: "Sidste år" },
  ];

  return (
    <div className="divide-y divide-slate-100">
      {/* Search & filters */}
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Søg på fakturanummer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-500" htmlFor="datePreset">
              Datointerval
            </label>
            <select
              id="datePreset"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {datePresetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          {statusFilters.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition-colors ${
                statusFilter === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white/60 text-slate-500 hover:border-blue-400 hover:text-blue-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-[11px] font-semibold text-slate-600">
          <span>
            Viser {totalRows} {totalRows === 1 ? "faktura" : "fakturaer"}
          </span>
          <span>Åben saldo {formatCurrency(metrics.balanceDue)}</span>
          <span>Gns. {formatCurrency(metrics.averageInvoice)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-3">Faktura nr.</th>
              <th className="px-6 py-3">Dato</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Beløb</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white/80">
            {filteredInvoices.map((invoice) => (
              <tr
                key={invoice.invoiceNumber}
                onClick={() => navigate(`/invoices/${invoice.invoiceNumber}`)}
                className="cursor-pointer bg-white transition-colors hover:bg-slate-50"
              >
                <td className="px-6 py-3 text-sm font-medium text-slate-900">
                  {invoice.invoiceNumber}
                </td>
                <td className="px-6 py-3 text-xs text-slate-500">
                  {new Date(invoice.postingDate).toLocaleDateString("da-DK", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      invoice.status === "Overdue"
                        ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                        : invoice.status === "Paid"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                          : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                    }`}
                  >
                    {getStatusLabel(invoice.status)}
                  </span>
                </td>
                <td className="px-6 py-3 text-right font-mono text-sm text-slate-900">
                  {formatCurrency(invoice.amount)}
                </td>
              </tr>
            ))}
            {filteredInvoices.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-10 text-center text-sm text-slate-500"
                >
                  Ingen fakturaer matcher dine nuværende filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
