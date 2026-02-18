// src/components/BillingSummary.tsx
import { calculateBillingMetrics } from "../utils/billingCalculations";
import { useInvoices } from "../hooks/useInvoices";

export const BillingSummary = () => {
  const { data: invoices } = useInvoices();
  const {
    totalInvoiced,
    balanceDue,
    overdueAmount,
    currentMonthVolume,
    paidThisMonth,
    averageInvoice,
    openInvoiceCount,
  } = calculateBillingMetrics(invoices);

  const formatCurrency = (val: number) =>
    val.toLocaleString("da-DK", { style: "currency", currency: "DKK" });

  const cards = [
    {
      label: "Samlet omsætning",
      value: formatCurrency(totalInvoiced),
      helper: `Gns. faktura ${formatCurrency(averageInvoice || 0)}`,
      border: "border-slate-200",
      accent: "text-slate-900",
    },
    {
      label: "Nuværende måned",
      value: formatCurrency(currentMonthVolume),
      helper: `Betalt denne måned ${formatCurrency(paidThisMonth)}`,
      border: "border-blue-200",
      accent: "text-blue-700",
    },
    {
      label: "Skyldig saldo",
      value: formatCurrency(balanceDue),
      helper: `${openInvoiceCount} åbne fakturaer`,
      border: "border-amber-200",
      accent: "text-amber-700",
    },
    {
      label: "Forfalden",
      value: formatCurrency(overdueAmount),
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
            {card.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
        </article>
      ))}
    </section>
  );
};
