// src/components/DashboardStats.tsx
import { useInvoices } from "../hooks/useInvoices";
import { calculateAgingBuckets } from "../utils/billingCalculations";
import { AlertCircle, Hourglass, TimerReset, Timer } from "lucide-react";

export const DashboardStats = () => {
  const { data: invoices } = useInvoices();
  const aging = calculateAgingBuckets(invoices);

  const formatCurrency = (val: number) =>
    val.toLocaleString("da-DK", { style: "currency", currency: "DKK" });

  const cards = [
    {
      label: "0-30 dage",
      value: aging["0-30"],
      icon: TimerReset,
      accent: "text-slate-800",
      border: "border-slate-200",
    },
    {
      label: "31-60 dage",
      value: aging["31-60"],
      icon: Timer,
      accent: "text-amber-700",
      border: "border-amber-200",
    },
    {
      label: "61-90 dage",
      value: aging["61-90"],
      icon: Hourglass,
      accent: "text-orange-700",
      border: "border-orange-200",
    },
    {
      label: "90+ dage",
      value: aging["90+"],
      icon: AlertCircle,
      accent: "text-red-700",
      border: "border-red-200",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border ${card.border} bg-white/95 p-5 shadow-sm`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${card.accent}`}>
                {formatCurrency(card.value)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <card.icon className={`h-6 w-6 ${card.accent}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
