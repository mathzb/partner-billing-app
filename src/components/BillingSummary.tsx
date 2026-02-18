// src/components/BillingSummary.tsx
import { calculateBillingMetrics } from "../utils/billingCalculations";
import { useInvoices } from "../hooks/useInvoices";
import { useAmountDisplayStore } from "../store/useAmountDisplayStore";

export const BillingSummary = () => {
  const { data: invoices } = useInvoices();
  const amountDisplayMode = useAmountDisplayStore((state) => state.mode);
  const {
    totalInvoiced,
    balanceDue,
    overdueAmount,
    currentMonthVolume,
    paidThisMonth,
    averageInvoice,
    openInvoiceCount,
  } = calculateBillingMetrics(invoices, "inclVat");
  const {
    totalInvoiced: totalInvoicedExclVat,
    balanceDue: balanceDueExclVat,
    overdueAmount: overdueAmountExclVat,
    currentMonthVolume: currentMonthVolumeExclVat,
    paidThisMonth: paidThisMonthExclVat,
    averageInvoice: averageInvoiceExclVat,
  } = calculateBillingMetrics(invoices, "exclVat");

  const formatCurrency = (val: number) =>
    val.toLocaleString("da-DK", { style: "currency", currency: "DKK" });

  const cards = [
    {
      label: "Samlet omsætning",
      valueInclVat: formatCurrency(totalInvoiced),
      valueExclVat: formatCurrency(totalInvoicedExclVat),
      helper:
        amountDisplayMode === "both"
          ? `Gns. faktura inkl. moms ${formatCurrency(averageInvoice || 0)} / ekskl. moms ${formatCurrency(averageInvoiceExclVat || 0)}`
          : amountDisplayMode === "exclVat"
            ? `Gns. faktura ekskl. moms ${formatCurrency(averageInvoiceExclVat || 0)}`
            : `Gns. faktura inkl. moms ${formatCurrency(averageInvoice || 0)}`,
      border: "border-slate-200",
      accent: "text-slate-900",
    },
    {
      label: "Nuværende måned",
      valueInclVat: formatCurrency(currentMonthVolume),
      valueExclVat: formatCurrency(currentMonthVolumeExclVat),
      helper:
        amountDisplayMode === "both"
          ? `Betalt denne måned inkl. moms ${formatCurrency(paidThisMonth)} / ekskl. moms ${formatCurrency(paidThisMonthExclVat)}`
          : amountDisplayMode === "exclVat"
            ? `Betalt denne måned ekskl. moms ${formatCurrency(paidThisMonthExclVat)}`
            : `Betalt denne måned inkl. moms ${formatCurrency(paidThisMonth)}`,
      border: "border-blue-200",
      accent: "text-blue-700",
    },
    {
      label: "Skyldig saldo",
      valueInclVat: formatCurrency(balanceDue),
      valueExclVat: formatCurrency(balanceDueExclVat),
      helper: `${openInvoiceCount} åbne fakturaer`,
      border: "border-amber-200",
      accent: "text-amber-700",
    },
    {
      label: "Forfalden",
      valueInclVat: formatCurrency(overdueAmount),
      valueExclVat: formatCurrency(overdueAmountExclVat),
      helper: "Følg op med kontoansvarlige",
      border: "border-red-200",
      accent: "text-red-700",
    },
  ];

  return (
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className={`rounded-2xl border ${card.border} bg-white/95 p-5 shadow-sm`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {card.label}
          </p>
          <p className={`mt-2 text-2xl font-semibold ${card.accent}`}>
            {amountDisplayMode === "exclVat"
              ? card.valueExclVat
              : card.valueInclVat}{" "}
            <span className="text-xs text-slate-500">
              {amountDisplayMode === "exclVat" ? "ekskl. moms" : "inkl. moms"}
            </span>
          </p>
          {amountDisplayMode === "both" && (
            <p className="mt-1 text-sm text-slate-600">
              {card.valueExclVat} ekskl. moms
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
        </article>
      ))}
    </section>
  );
};
