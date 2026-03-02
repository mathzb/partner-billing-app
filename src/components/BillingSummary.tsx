// src/components/BillingSummary.tsx
import { TrendingUp, Calendar, CreditCard, AlertCircle } from "lucide-react";
import { calculateBillingMetrics } from "../utils/billingCalculations";
import { useInvoices } from "../hooks/useInvoices";
import { useAmountDisplayStore } from "../store/useAmountDisplayStore";

const formatCurrency = (val: number) =>
  val.toLocaleString("da-DK", { style: "currency", currency: "DKK" });

type MetricCard = {
  label: string;
  valueInclVat: string;
  valueExclVat: string;
  helper: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accent: string;
  accentDark: string;
  border: string;
  borderDark: string;
};

export const BillingSummary = () => {
  const { data: invoices } = useInvoices();
  const amountDisplayMode = useAmountDisplayStore((state) => state.mode);

  const incl = calculateBillingMetrics(invoices, "inclVat");
  const excl = calculateBillingMetrics(invoices, "exclVat");

  const cards: MetricCard[] = [
    {
      label: "Samlet omsætning",
      valueInclVat: formatCurrency(incl.totalInvoiced),
      valueExclVat: formatCurrency(excl.totalInvoiced),
      helper:
        amountDisplayMode === "both"
          ? `Gns. ${formatCurrency(incl.averageInvoice ?? 0)} / ${formatCurrency(excl.averageInvoice ?? 0)}`
          : amountDisplayMode === "exclVat"
            ? `Gns. faktura ${formatCurrency(excl.averageInvoice ?? 0)}`
            : `Gns. faktura ${formatCurrency(incl.averageInvoice ?? 0)}`,
      icon: TrendingUp,
      iconBg: "bg-blue-50 dark:bg-blue-950/60",
      iconColor: "text-blue-600 dark:text-blue-400",
      accent: "text-slate-900 dark:text-slate-100",
      accentDark: "dark:text-slate-100",
      border: "border-slate-200 dark:border-slate-800",
      borderDark: "",
    },
    {
      label: "Nuværende måned",
      valueInclVat: formatCurrency(incl.currentMonthVolume),
      valueExclVat: formatCurrency(excl.currentMonthVolume),
      helper:
        amountDisplayMode === "both"
          ? `Betalt ${formatCurrency(incl.paidThisMonth)} / ${formatCurrency(excl.paidThisMonth)}`
          : amountDisplayMode === "exclVat"
            ? `Betalt denne måned ${formatCurrency(excl.paidThisMonth)}`
            : `Betalt denne måned ${formatCurrency(incl.paidThisMonth)}`,
      icon: Calendar,
      iconBg: "bg-violet-50 dark:bg-violet-950/60",
      iconColor: "text-violet-600 dark:text-violet-400",
      accent: "text-violet-700 dark:text-violet-400",
      accentDark: "",
      border: "border-violet-200 dark:border-violet-900",
      borderDark: "",
    },
    {
      label: "Skyldig saldo",
      valueInclVat: formatCurrency(incl.balanceDue),
      valueExclVat: formatCurrency(excl.balanceDue),
      helper: `${incl.openInvoiceCount} åbne fakturaer`,
      icon: CreditCard,
      iconBg: "bg-amber-50 dark:bg-amber-950/60",
      iconColor: "text-amber-600 dark:text-amber-400",
      accent: "text-amber-700 dark:text-amber-400",
      accentDark: "",
      border: "border-amber-200 dark:border-amber-900",
      borderDark: "",
    },
    {
      label: "Forfalden",
      valueInclVat: formatCurrency(incl.overdueAmount),
      valueExclVat: formatCurrency(excl.overdueAmount),
      helper: "Kræver opfølgning",
      icon: AlertCircle,
      iconBg: "bg-rose-50 dark:bg-rose-950/60",
      iconColor: "text-rose-600 dark:text-rose-400",
      accent: "text-rose-700 dark:text-rose-400",
      accentDark: "",
      border: "border-rose-200 dark:border-rose-900",
      borderDark: "",
    },
  ];

  const displayValue = (card: MetricCard) =>
    amountDisplayMode === "exclVat" ? card.valueExclVat : card.valueInclVat;

  const vatLabel =
    amountDisplayMode === "exclVat" ? "ekskl. moms" : "inkl. moms";

  return (
    <section
      aria-label="Fakturaoversigt"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className={`card-lift group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${card.border}`}
          >
            {/* Top: Icon + Label */}
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.iconBg}`}
                aria-hidden
              >
                <Icon className={`h-4 w-4 ${card.iconColor}`} />
              </span>
            </div>

            {/* Primary value */}
            <p
              className={`mt-3 text-2xl font-bold tabular tracking-tight ${card.accent}`}
            >
              {displayValue(card)}
            </p>

            {/* VAT label */}
            <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {vatLabel}
            </p>

            {/* Both mode secondary value */}
            {amountDisplayMode === "both" && (
              <p className="mt-1 text-sm font-semibold tabular text-slate-600 dark:text-slate-300">
                {card.valueExclVat}{" "}
                <span className="text-[11px] font-normal text-slate-400">
                  ekskl.
                </span>
              </p>
            )}

            {/* Helper */}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {card.helper}
            </p>

            {/* Subtle accent bottom strip */}
            <div
              className={`absolute bottom-0 left-0 h-0.5 w-full opacity-60 ${card.iconBg}`}
              aria-hidden
            />
          </article>
        );
      })}
    </section>
  );
};
