// src/components/DashboardStats.tsx
import { useInvoices } from "../hooks/useInvoices";
import { calculateAgingBuckets } from "../utils/billingCalculations";
import { AlertCircle, Hourglass, TimerReset, Timer } from "lucide-react";

const formatCurrency = (val: number) =>
  val.toLocaleString("da-DK", { style: "currency", currency: "DKK" });

export const DashboardStats = () => {
  const { data: invoices } = useInvoices();
  const aging = calculateAgingBuckets(invoices);

  const cards = [
    {
      label: "0–30 dage",
      value: aging["0-30"],
      icon: TimerReset,
      accent: "text-slate-800 dark:text-slate-200",
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconColor: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-800",
    },
    {
      label: "31–60 dage",
      value: aging["31-60"],
      icon: Timer,
      accent: "text-amber-700 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-950/60",
      iconColor: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-900",
    },
    {
      label: "61–90 dage",
      value: aging["61-90"],
      icon: Hourglass,
      accent: "text-orange-700 dark:text-orange-400",
      iconBg: "bg-orange-50 dark:bg-orange-950/60",
      iconColor: "text-orange-600 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-900",
    },
    {
      label: "90+ dage",
      value: aging["90+"],
      icon: AlertCircle,
      accent: "text-rose-700 dark:text-rose-400",
      iconBg: "bg-rose-50 dark:bg-rose-950/60",
      iconColor: "text-rose-600 dark:text-rose-400",
      border: "border-rose-200 dark:border-rose-900",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`card-lift rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${card.border}`}
          >
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
            <p
              className={`mt-3 text-2xl font-bold tabular tracking-tight ${card.accent}`}
            >
              {formatCurrency(card.value)}
            </p>
          </div>
        );
      })}
    </div>
  );
};
