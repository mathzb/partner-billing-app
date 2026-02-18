// src/components/InvoiceDetailPanel.tsx
import { useCallback, useMemo, useState } from "react";
import { X, Receipt, Building2, Package } from "lucide-react";
import { useInvoiceDetail } from "../hooks/useInvoiceDetail";
import { useInvoiceTypes } from "../hooks/useInvoiceTypes";
import { Skeleton } from "./ui/Skeleton";

interface Props {
  invoiceNo: string | null;
  onClose: () => void;
}

export const InvoiceDetailPanel = ({ invoiceNo, onClose }: Props) => {
  const { data: detail, isLoading } = useInvoiceDetail(invoiceNo);
  const { data: invoiceTypes } = useInvoiceTypes();
  const invoiceTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    (invoiceTypes ?? []).forEach((type) => map.set(type.id, type.description));
    return map;
  }, [invoiceTypes]);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const resolveInvoiceType = useCallback(
    (billingTypeId?: string, fallback?: string): string | undefined => {
      if (billingTypeId) {
        const resolved = invoiceTypeMap.get(billingTypeId);
        if (resolved) return resolved;
      }
      return fallback;
    },
    [invoiceTypeMap],
  );

  const handleCopyLines = useCallback(async () => {
    if (!detail?.lines?.length) return;

    const tableRows = [
      ["Beskrivelse", "Fakturatype", "Beløb (DKK)"],
      ...detail.lines.map((line) => {
        const billingLabel =
          resolveInvoiceType(line.billingTypeId, line.billingTypeDescription) ??
          "—";
        const formattedAmount = line.amount.toLocaleString("da-DK", {
          style: "currency",
          currency: "DKK",
        });
        const cleanDescription = line.description.replace(/\s+/g, " ").trim();
        return [cleanDescription, billingLabel, formattedAmount];
      }),
    ]
      .map((row) => row.join("\t"))
      .join("\n");

    try {
      const clipboardApi = navigator?.clipboard;
      if (!clipboardApi || typeof clipboardApi.writeText !== "function") {
        throw new Error("Clipboard API er ikke tilgængelig");
      }
      await clipboardApi.writeText(tableRows);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.error("Kunne ikke kopiere fakturatabel", error);
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 4000);
    }
  }, [detail, resolveInvoiceType]);

  if (!invoiceNo) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md transform bg-white shadow-2xl transition-all">
          <div className="flex h-full flex-col overflow-y-scroll bg-white p-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Receipt className="text-blue-600" /> Faktura nr. {invoiceNo}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {isLoading ? (
              <div className="mt-6 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <div className="space-y-2 pt-2">
                  {[...Array(4)].map((_, idx) => (
                    <Skeleton key={idx} className="h-8 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              detail && (
                <div className="mt-6 space-y-8">
                  {/* Customer Section */}
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Kundeinformation
                    </h3>
                    <p className="mt-2 text-lg font-medium text-gray-900">
                      {detail.customerName}
                    </p>
                  </section>

                  {/* Tenant / Customer Breakdown */}
                  {detail.tenants && detail.tenants.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                        Fordeling pr. tenant
                      </h3>
                      <div className="space-y-4">
                        {detail.tenants.map((tenant) => (
                          <div
                            key={tenant.id}
                            className="border border-gray-100 rounded-lg p-3 bg-gray-50"
                          >
                            <div className="flex justify-between items-baseline mb-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {tenant.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {tenant.domain}
                                </p>
                              </div>
                              <div className="text-sm font-mono font-semibold text-gray-900">
                                {tenant.amount.toLocaleString("da-DK", {
                                  style: "currency",
                                  currency: "DKK",
                                })}
                              </div>
                            </div>

                            {tenant.subscriptions.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {tenant.subscriptions.map((sub) => (
                                  <div
                                    key={sub.id}
                                    className="flex justify-between text-xs text-gray-700"
                                  >
                                    <div className="max-w-[70%]">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium">
                                          {sub.nickname || sub.description}
                                        </p>
                                        {resolveInvoiceType(
                                          sub.billingTypeId,
                                          sub.billingTypeDescription,
                                        ) && (
                                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                                            {resolveInvoiceType(
                                              sub.billingTypeId,
                                              sub.billingTypeDescription,
                                            )}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-gray-500">
                                        {sub.licensQuantity} licenser
                                      </p>
                                    </div>
                                    <div className="text-right font-mono">
                                      {sub.amount.toLocaleString("da-DK", {
                                        style: "currency",
                                        currency: "DKK",
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Billing Lines (raw invoice lines) */}
                  <section>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Package className="h-3 w-3" /> Fakturalinjer
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] font-semibold">
                        {copyState === "copied" && (
                          <span className="text-emerald-600">Kopieret</span>
                        )}
                        {copyState === "error" && (
                          <span className="text-red-600">
                            Kunne ikke kopiere
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleCopyLines}
                          disabled={!detail?.lines?.length}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Kopier tabel
                        </button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {detail.lines.map((line, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-start border-b border-gray-50 pb-3 text-sm"
                        >
                          <div className="max-w-[70%] space-y-1">
                            {resolveInvoiceType(
                              line.billingTypeId,
                              line.billingTypeDescription,
                            ) && (
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                                {resolveInvoiceType(
                                  line.billingTypeId,
                                  line.billingTypeDescription,
                                )}
                              </span>
                            )}
                            <p className="text-gray-600">{line.description}</p>
                          </div>
                          <span className="font-mono font-medium">
                            {line.amount.toLocaleString("da-DK", {
                              style: "currency",
                              currency: "DKK",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Total Summary */}
                  <div className="mt-auto pt-6 border-t">
                    <div className="flex justify-between text-lg font-bold">
                      <span>
                        {detail.amountInclVat.toLocaleString("da-DK", {
                          style: "currency",
                          currency: "DKK",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
