// src/pages/InvoiceDetailPage.tsx
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { useInvoiceDetail } from "../hooks/useInvoiceDetail";
import { useTenantDiscounts } from "../hooks/useTenantDiscounts";
import { useAmountDisplayStore } from "../store/useAmountDisplayStore";
import type { InvoiceTenantBreakdown } from "../types/invoice";
import {
  aggregateVendorsFromSubscriptions,
  type AggregatedVendor,
} from "../utils/billingCalculations";

type CopyState = "idle" | "copied" | "error";
type CopyStateMap = Record<string, CopyState>;

type GroupedCustomer = {
  key: string;
  id: string;
  name: string;
  domains: Set<string>;
  references: Set<string>;
  subscriptions: NonNullable<InvoiceTenantBreakdown["subscriptions"]>;
};

type CustomerCard = {
  id: string;
  name: string;
  domains: string[];
  references: string[];
  subscriptions: NonNullable<InvoiceTenantBreakdown["subscriptions"]>;
};

type WlOption = {
  label: string;
  value: string;
};

const currencyFormatter = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat("da-DK", {
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number | null | undefined) =>
  currencyFormatter.format(typeof value === "number" ? value : 0);

const formatQuantityValue = (value: number | null | undefined) =>
  quantityFormatter.format(typeof value === "number" ? value : 0);

const getVendorQuantityLabel = (vendorName: string) => {
  const normalized = vendorName.toLowerCase();
  if (normalized.includes("keepit")) return "seats";
  return "licenses";
};

const translateQuantityLabel = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized === "seats") return "seats";
  if (normalized === "licenses") return "licenser";
  if (normalized === "gb") return "GB";
  return label;
};

const formatQuantityWithLabel = (
  label: string,
  value: number | null | undefined,
) => {
  const formattedValue = formatQuantityValue(value);
  const normalized = label.toLowerCase();
  if (normalized === "gb") return `${formattedValue} GB`;
  if (normalized === "seats") return `${formattedValue} seats`;
  return `${formattedValue} licenser`;
};

const formatLicenseCountLabel = (value: number | null | undefined) => {
  const numeric = typeof value === "number" ? value : 0;
  const formatted = formatQuantityValue(numeric);
  return `${formatted} ${numeric === 1 ? "licens" : "licenser"}`;
};

const statusLabelMap: Record<string, string> = {
  overdue: "Forfalden",
  unpaid: "Ubetalt",
  paid: "Betalt",
};

const billingFrequencyMap: Record<string, string> = {
  monthly: "Månedlig",
  yearly: "Årlig",
  annually: "Årlig",
  quarterly: "Kvartalsvis",
  weekly: "Ugentlig",
  daily: "Daglig",
  mixed: "Blandet",
};

const commitmentTermMap: Record<string, string> = {
  monthly: "Månedlig",
  yearly: "Årlig",
  annually: "Årlig",
  quarterly: "Kvartalsvis",
  contract: "Kontrakt",
  mixed: "Blandet",
};

const translateApiLabel = (
  value: string | null | undefined,
  dictionary: Record<string, string>,
) => {
  if (!value) return "—";
  const normalized = value.trim().toLowerCase();
  return dictionary[normalized] ?? value;
};

const translateBillingFrequency = (value: string | null | undefined) =>
  translateApiLabel(value, billingFrequencyMap);

const translateCommitmentTerm = (value: string | null | undefined) =>
  translateApiLabel(value, commitmentTermMap);

const getLocalizedStatus = (status: string) =>
  statusLabelMap[status.toLowerCase()] ?? status;

const pageSizeOptions = [5, 10, 20];

const extractWlCode = (reference?: string | null) => {
  if (!reference) return "";
  const wlMatch = reference.match(/wl\s*(\d+)/i);
  if (wlMatch?.[1]) return wlMatch[1];
  const digits = reference.match(/(\d+)/);
  return digits?.[1] ?? "";
};

const buildWlOptions = (
  tenants: InvoiceTenantBreakdown[] | undefined,
): WlOption[] => {
  const codes = new Set<string>();
  (tenants ?? []).forEach((tenant) => {
    const code = extractWlCode(tenant.customerReference);
    if (code) codes.add(code);
  });

  const entries = Array.from(codes).sort((a, b) => Number(a) - Number(b));
  return [
    { label: "Alle WL", value: "all" },
    ...entries.map((code) => ({ label: `WL ${code}`, value: code })),
  ];
};

export const InvoiceDetailPage = () => {
  const { invoiceNo } = useParams<{ invoiceNo: string }>();
  const amountDisplayMode = useAmountDisplayStore((state) => state.mode);
  const {
    data: detail,
    isLoading,
    isError,
  } = useInvoiceDetail(invoiceNo ?? null);
  const { getDiscountRate, setDiscountRate } = useTenantDiscounts();

  const [customerSearch, setCustomerSearch] = useState("");
  const [wlFilter, setWlFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(
    () => new Set(),
  );
  const [vendorCopyStates, setVendorCopyStates] = useState<CopyStateMap>({});
  const [expandedProductDetails, setExpandedProductDetails] = useState<
    Set<string>
  >(() => new Set());
  const vendorCopyTimeouts = useRef<Map<string, number>>(new Map());

  const wlOptions = useMemo(
    () => buildWlOptions(detail?.tenants),
    [detail?.tenants],
  );

  useEffect(() => {
    if (wlFilter === "all") return;
    const hasFilter = wlOptions.some((option) => option.value === wlFilter);
    if (!hasFilter) {
      setWlFilter("all");
    }
  }, [wlFilter, wlOptions]);

  useEffect(() => {
    const timers = vendorCopyTimeouts.current;
    return () => {
      if (typeof window === "undefined") return;
      timers.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timers.clear();
    };
  }, []);

  const scheduleCopyReset = useCallback((vendorKey: string, delay: number) => {
    if (typeof window === "undefined") return;
    const timers = vendorCopyTimeouts.current;
    const existing = timers.get(vendorKey);
    if (existing) {
      window.clearTimeout(existing);
    }
    const timeoutId = window.setTimeout(() => {
      setVendorCopyStates((prev) => ({ ...prev, [vendorKey]: "idle" }));
      timers.delete(vendorKey);
    }, delay);
    timers.set(vendorKey, timeoutId);
  }, []);

  const toggleProductDetails = useCallback((productKey: string) => {
    setExpandedProductDetails((prev) => {
      const next = new Set(prev);
      if (next.has(productKey)) {
        next.delete(productKey);
      } else {
        next.add(productKey);
      }
      return next;
    });
  }, []);

  const pruneProductDetailsForVendor = useCallback((vendorKey: string) => {
    setExpandedProductDetails((prev) => {
      if (prev.size === 0) return prev;
      let mutated = false;
      const next = new Set<string>();
      prev.forEach((key) => {
        if (key.startsWith(`${vendorKey}::`)) {
          mutated = true;
          return;
        }
        next.add(key);
      });
      return mutated ? next : prev;
    });
  }, []);

  const toggleVendorExpansion = useCallback(
    (vendorKey: string) => {
      setExpandedVendors((prev) => {
        const next = new Set(prev);
        if (next.has(vendorKey)) {
          next.delete(vendorKey);
          pruneProductDetailsForVendor(vendorKey);
        } else {
          next.add(vendorKey);
        }
        return next;
      });
    },
    [pruneProductDetailsForVendor],
  );

  const handleCopyVendor = useCallback(
    async (
      customer: CustomerCard,
      vendor: AggregatedVendor,
      vendorKey: string,
    ) => {
      const quantityLabel = getVendorQuantityLabel(vendor.vendorName);
      const rows: string[][] = [
        ["Kunde", customer.name],
        ["Leverandør", vendor.vendorName],
        [
          "I alt",
          formatQuantityWithLabel(quantityLabel, vendor.totalLicenses),
          formatCurrency(vendor.totalAmount),
        ],
        [""],
        [
          "Produkt",
          "Mængde",
          "Fakturering",
          "Binding",
          "Kostpris (DKK)",
          "Rabat %",
          "Beløb (DKK)",
        ],
      ];

      vendor.products.forEach((product) => {
        const discountRate =
          getDiscountRate(
            customer.id,
            vendor.vendorName,
            product.displayName,
          ) ?? 0;
        const baseAmount = product.amount ?? 0;
        const discountedAmount = baseAmount * (1 - discountRate / 100);
        const quantityValue = formatQuantityWithLabel(
          quantityLabel,
          product.licenses,
        );

        rows.push([
          product.displayName,
          quantityValue,
          translateBillingFrequency(product.billing),
          translateCommitmentTerm(product.commitment),
          formatCurrency(product.costAmount),
          discountRate ? `${discountRate}%` : "0%",
          discountRate
            ? `${formatCurrency(discountedAmount)} (før rabat: ${formatCurrency(baseAmount)})`
            : formatCurrency(baseAmount),
        ]);
      });

      const tableText = rows.map((row) => row.join("\t")).join("\n");

      try {
        const clipboardApi =
          typeof navigator !== "undefined" ? navigator.clipboard : undefined;
        if (!clipboardApi || typeof clipboardApi.writeText !== "function") {
          throw new Error("Clipboard API er ikke tilgængelig");
        }
        await clipboardApi.writeText(tableText);
        setVendorCopyStates((prev) => ({ ...prev, [vendorKey]: "copied" }));
        scheduleCopyReset(vendorKey, 2000);
      } catch (error) {
        console.error("Kunne ikke kopiere leverandørtabel", error);
        setVendorCopyStates((prev) => ({ ...prev, [vendorKey]: "error" }));
        scheduleCopyReset(vendorKey, 4000);
      }
    },
    [getDiscountRate, scheduleCopyReset],
  );

  const resetToFirstPage = useCallback(() => {
    setCurrentPage(1);
    setExpandedVendors(() => new Set());
    setExpandedProductDetails(() => new Set());
  }, []);

  const filteredTenants = useMemo(() => {
    const normalizedSearch = customerSearch.trim().toLowerCase();
    return (detail?.tenants ?? []).filter((tenant) => {
      const wlCode = extractWlCode(tenant.customerReference);
      const matchesWl = wlFilter === "all" || wlCode === wlFilter;

      if (!normalizedSearch) return matchesWl;

      const haystack = [
        tenant.name,
        tenant.domain,
        tenant.customerName,
        tenant.customerReference,
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      const matchesSearch = haystack.some((value) =>
        value.includes(normalizedSearch),
      );

      return matchesSearch && matchesWl;
    });
  }, [detail?.tenants, customerSearch, wlFilter]);

  const groupedCustomers: CustomerCard[] = useMemo(() => {
    const map = new Map<string, GroupedCustomer>();

    filteredTenants.forEach((tenant) => {
      const mapKey = (
        tenant.customerName ??
        tenant.name ??
        tenant.id
      ).toLowerCase();
      const existing = map.get(mapKey);

      if (existing) {
        if (tenant.domain) existing.domains.add(tenant.domain);
        if (tenant.customerReference)
          existing.references.add(tenant.customerReference);
        existing.subscriptions.push(...(tenant.subscriptions ?? []));
        return;
      }

      map.set(mapKey, {
        key: mapKey,
        id: tenant.id,
        name: tenant.customerName ?? tenant.name ?? "Kunde",
        domains: new Set(tenant.domain ? [tenant.domain] : []),
        references: new Set(
          tenant.customerReference ? [tenant.customerReference] : [],
        ),
        subscriptions: [...(tenant.subscriptions ?? [])],
      });
    });

    return Array.from(map.values()).map((group, index) => ({
      id: group.id || `${group.key}-${index}`,
      name: group.name,
      domains: Array.from(group.domains),
      references: Array.from(group.references),
      subscriptions: group.subscriptions,
    }));
  }, [filteredTenants]);

  const totalCustomers = groupedCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalCustomers / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedCustomers = groupedCustomers.slice(
    startIndex,
    startIndex + pageSize,
  );
  const showingFrom = totalCustomers === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(
    startIndex + paginatedCustomers.length,
    totalCustomers,
  );

  const tenantCards = paginatedCustomers.map((customer) => {
    const vendors = aggregateVendorsFromSubscriptions(customer.subscriptions);

    const totals = vendors.reduce(
      (acc, vendor) => {
        acc.totalLicenses += vendor.totalLicenses;
        acc.totalAmount += vendor.totalAmount;

        const vendorDiscountedAmount = vendor.products.reduce(
          (sum, product) => {
            const discountRate =
              getDiscountRate(
                customer.id,
                vendor.vendorName,
                product.displayName,
              ) ?? 0;
            const baseAmount = product.amount ?? 0;
            return sum + baseAmount * (1 - discountRate / 100);
          },
          0,
        );

        acc.totalDiscountedAmount += vendorDiscountedAmount;
        return acc;
      },
      { totalLicenses: 0, totalAmount: 0, totalDiscountedAmount: 0 },
    );

    const hasTenantDiscount =
      Math.abs(totals.totalAmount - totals.totalDiscountedAmount) > 0.005;
    const isReferenceMissing = customer.references.length === 0;

    return (
      <section
        key={customer.id}
        className={`rounded-xl shadow-sm p-5 space-y-3 border ${
          isReferenceMissing
            ? "border-amber-300 bg-amber-50/70 ring-1 ring-amber-100"
            : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex justify-between items-baseline">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              {customer.name}
            </h2>
            {customer.domains.length > 0 && (
              <p className="text-xs text-gray-500">
                {customer.domains.join(", ")}
              </p>
            )}
            {customer.references.length > 0 ? (
              <p className="text-[11px] text-gray-500 mt-1">
                Ref.: {customer.references.join(", ")}
              </p>
            ) : (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <AlertTriangle className="h-3 w-3" /> Reference mangler
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-mono font-semibold">
              {hasTenantDiscount ? (
                <span className="flex flex-col items-end leading-tight">
                  <span className="text-xs text-slate-400 line-through">
                    {formatCurrency(totals.totalAmount)}
                  </span>
                  <span>{formatCurrency(totals.totalDiscountedAmount)}</span>
                </span>
              ) : (
                formatCurrency(totals.totalAmount)
              )}
            </p>
            <p className="text-[11px] text-gray-400">
              I alt for tenant ({formatQuantityValue(totals.totalLicenses)}{" "}
              enheder)
            </p>
            <div className="mt-2 text-[11px] font-semibold text-slate-400">
              Klik på en leverandør for at kopiere tabellen
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Leverandør</th>
                <th className="px-3 py-2 text-right font-medium">Licenser</th>
                <th className="px-3 py-2 text-right font-medium">Beløb</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendors.map((vendor) => {
                const key = `${customer.id}-${vendor.vendorName}`;
                const isExpanded = expandedVendors.has(key);
                const vendorCopyKey = `${customer.id}-${vendor.vendorName}-copy`;
                const vendorCopyState =
                  vendorCopyStates[vendorCopyKey] ?? "idle";
                const quantityLabel = getVendorQuantityLabel(vendor.vendorName);
                const vendorDiscountedTotal = vendor.products.reduce(
                  (sum, product) => {
                    const discountRate =
                      getDiscountRate(
                        customer.id,
                        vendor.vendorName,
                        product.displayName,
                      ) ?? 0;
                    const baseAmount = product.amount ?? 0;
                    return sum + baseAmount * (1 - discountRate / 100);
                  },
                  0,
                );
                const vendorHasDiscount =
                  Math.abs(vendor.totalAmount - vendorDiscountedTotal) > 0.005;

                return (
                  <Fragment key={key}>
                    <tr className="group hover:bg-gray-50">
                      <td className="px-3 py-2 align-top whitespace-normal">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={`${key}-details`}
                          className="flex w-full items-start justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                          onClick={() => toggleVendorExpansion(key)}
                        >
                          <span className="font-medium text-slate-800">
                            {vendor.vendorName}
                          </span>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition-colors group-hover:border-slate-400 group-hover:text-slate-800"
                              role="presentation"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" aria-hidden />
                              ) : (
                                <ChevronDown className="h-3 w-3" aria-hidden />
                              )}
                              {isExpanded ? "Skjul detaljer" : "Vis detaljer"}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCopyVendor(
                                  customer,
                                  vendor,
                                  vendorCopyKey,
                                );
                              }}
                              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-700"
                            >
                              {vendorCopyState === "copied"
                                ? "Kopieret"
                                : vendorCopyState === "error"
                                  ? "Fejl"
                                  : "Kopier"}
                            </button>
                          </span>
                        </button>
                        {!isExpanded && vendor.products.length > 0 && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {vendor.products
                              .slice(0, 3)
                              .map(
                                (product) =>
                                  `${product.displayName} (${formatQuantityWithLabel(quantityLabel, product.licenses)})`,
                              )
                              .join(", ")}
                            {vendor.products.length > 3 &&
                              ` +${vendor.products.length - 3} flere`}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <div className="flex flex-col items-end text-[11px]">
                          <span className="font-mono text-sm text-slate-900">
                            {formatQuantityValue(vendor.totalLicenses)}
                          </span>
                          <span className="uppercase tracking-wide text-slate-400">
                            {translateQuantityLabel(quantityLabel)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right align-top font-mono">
                        {vendorHasDiscount ? (
                          <span className="flex flex-col items-end leading-tight">
                            <span className="text-[11px] text-slate-400 line-through">
                              {formatCurrency(vendor.totalAmount)}
                            </span>
                            <span>{formatCurrency(vendorDiscountedTotal)}</span>
                          </span>
                        ) : (
                          formatCurrency(vendor.totalAmount)
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70" id={`${key}-details`}>
                        <td colSpan={3} className="px-3 pb-3">
                          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 shadow-inner">
                            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 bg-blue-100/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                              <span>Produkt</span>
                              <span className="text-right">
                                {translateQuantityLabel(quantityLabel)}
                              </span>
                              <span className="text-right">Fakturering</span>
                              <span className="text-right">Binding</span>
                              <span className="text-right">Kostpris</span>
                              <span className="text-right">Rabat</span>
                              <span className="text-right">Beløb</span>
                            </div>
                            {vendor.products.map((product) => {
                              const storedDiscount = getDiscountRate(
                                customer.id,
                                vendor.vendorName,
                                product.displayName,
                              );
                              const discountRate = storedDiscount ?? 0;
                              const hasDiscount = (storedDiscount ?? 0) > 0;
                              const baseAmount = product.amount ?? 0;
                              const discountAmount =
                                (baseAmount * discountRate) / 100;
                              const discountedAmount =
                                baseAmount - discountAmount;
                              const discountInputId = `${key}-${product.displayName}-discount`;
                              const productDetailsKey = `${key}::${product.displayName}`;
                              const productDetailsDomId = `${productDetailsKey.replace(/[^a-zA-Z0-9-_]/g, "_")}-details`;
                              const detailEntries = product.details ?? [];
                              const canShowDetails =
                                (product.billing?.toLowerCase() === "mixed" ||
                                  product.commitment?.toLowerCase() ===
                                    "mixed") &&
                                detailEntries.length > 1;
                              const isProductDetailsExpanded =
                                expandedProductDetails.has(productDetailsKey);

                              return (
                                <Fragment key={`${key}-${product.displayName}`}>
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-t border-blue-100/70 bg-white/80 px-3 py-2 text-[12px] text-slate-700 transition-colors hover:bg-blue-50/70">
                                    <div>
                                      <p className="text-xs font-semibold text-slate-900">
                                        {product.displayName}
                                      </p>
                                      {canShowDetails && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleProductDetails(
                                              productDetailsKey,
                                            )
                                          }
                                          className="mt-1 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800 hover:border-blue-400"
                                          aria-expanded={
                                            isProductDetailsExpanded
                                          }
                                          aria-controls={productDetailsDomId}
                                        >
                                          {isProductDetailsExpanded
                                            ? "Skjul licenser"
                                            : "Vis licenser"}
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="inline-flex min-w-[3rem] justify-end rounded-full bg-blue-100 px-3 py-0.5 font-mono text-[11px] font-semibold text-blue-900 shadow-sm">
                                        {formatQuantityWithLabel(
                                          quantityLabel,
                                          product.licenses,
                                        )}
                                      </span>
                                    </div>
                                    <div className="text-right text-[11px] font-semibold text-slate-600">
                                      {translateBillingFrequency(
                                        product.billing,
                                      )}
                                    </div>
                                    <div className="text-right text-[11px] font-semibold text-slate-600">
                                      {translateCommitmentTerm(
                                        product.commitment,
                                      )}
                                    </div>
                                    <div className="text-right font-mono text-[12px] font-semibold text-slate-700">
                                      {formatCurrency(product.costAmount)}
                                    </div>
                                    <div className="text-right">
                                      <label
                                        className="sr-only"
                                        htmlFor={discountInputId}
                                      >
                                        Rabat for {product.displayName}
                                      </label>
                                      <div className="flex items-center justify-end gap-1">
                                        <input
                                          id={discountInputId}
                                          type="number"
                                          min={0}
                                          max={100}
                                          step={0.5}
                                          value={storedDiscount ?? ""}
                                          placeholder="0"
                                          className="w-20 rounded-lg border border-blue-200 bg-white px-2 py-1 text-right text-[11px] font-semibold text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                                          onChange={(event) => {
                                            const nextValue =
                                              event.target.value;
                                            if (nextValue === "") {
                                              setDiscountRate(
                                                customer.id,
                                                vendor.vendorName,
                                                product.displayName,
                                                null,
                                              );
                                              return;
                                            }
                                            const parsed = Number(nextValue);
                                            if (Number.isNaN(parsed)) return;
                                            setDiscountRate(
                                              customer.id,
                                              vendor.vendorName,
                                              product.displayName,
                                              parsed,
                                            );
                                          }}
                                        />
                                        <span className="text-[11px] font-semibold text-slate-500">
                                          %
                                        </span>
                                      </div>
                                      {hasDiscount && (
                                        <p className="mt-1 text-[10px] font-medium text-blue-700">
                                          -{formatCurrency(discountAmount)}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right font-mono text-[12px] font-semibold text-blue-900">
                                      {hasDiscount ? (
                                        <div className="flex flex-col items-end leading-tight">
                                          <span className="text-[11px] text-slate-400 line-through">
                                            {formatCurrency(baseAmount)}
                                          </span>
                                          <span>
                                            {formatCurrency(discountedAmount)}
                                          </span>
                                        </div>
                                      ) : (
                                        formatCurrency(baseAmount)
                                      )}
                                    </div>
                                  </div>
                                  {canShowDetails &&
                                    isProductDetailsExpanded && (
                                      <div
                                        id={productDetailsDomId}
                                        className="border-t border-blue-100/70 bg-blue-50/60 px-4 py-3 text-[11px] text-slate-600"
                                      >
                                        <div className="space-y-2">
                                          {detailEntries.map((detail) => {
                                            const detailKey = `${detail.label}-${detail.billing ?? "none"}-${detail.commitment ?? "none"}`;
                                            return (
                                              <div
                                                key={`${productDetailsKey}-${detailKey}`}
                                                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                                              >
                                                <div className="font-semibold text-slate-800">
                                                  {detail.label}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-600">
                                                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-mono text-blue-900">
                                                    {formatLicenseCountLabel(
                                                      detail.licenses,
                                                    )}
                                                  </span>
                                                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-mono text-slate-700">
                                                    Kostpris:{" "}
                                                    {formatCurrency(
                                                      detail.amount ?? 0,
                                                    )}
                                                  </span>
                                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 uppercase tracking-wide text-blue-800">
                                                    Fakturering:{" "}
                                                    {translateBillingFrequency(
                                                      detail.billing,
                                                    )}
                                                  </span>
                                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 uppercase tracking-wide text-blue-800">
                                                    Binding:{" "}
                                                    {translateCommitmentTerm(
                                                      detail.commitment,
                                                    )}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                </Fragment>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {vendors.length > 0 && (
                <tr className="bg-gray-50 font-medium">
                  <td className="px-3 py-2 text-right">I alt</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {totals.totalLicenses}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {hasTenantDiscount ? (
                      <span className="flex flex-col items-end leading-tight">
                        <span className="text-[11px] text-slate-400 line-through">
                          {formatCurrency(totals.totalAmount)}
                        </span>
                        <span>
                          {formatCurrency(totals.totalDiscountedAmount)}
                        </span>
                      </span>
                    ) : (
                      formatCurrency(totals.totalAmount)
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Kunne ikke hente fakturaoplysninger.
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="h-4 w-4" /> Tilbage til fakturaer
            </Link>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Faktura nr. {detail.invoiceNumber}
          </h1>
          <p className="text-xs text-gray-500">
            {new Date(detail.postingDate).toLocaleDateString("da-DK", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            {" - "}
            Forfalder{" "}
            {new Date(detail.dueDate).toLocaleDateString("da-DK", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="text-right space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            <span
              className={
                detail.status === "Overdue"
                  ? "text-red-600"
                  : detail.status === "Paid"
                    ? "text-green-600"
                    : "text-yellow-600"
              }
            >
              {getLocalizedStatus(detail.status)}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {amountDisplayMode === "both"
              ? `${formatCurrency(detail.amountInclVat)} inkl. moms / ${formatCurrency(detail.amount)} ekskl. moms`
              : amountDisplayMode === "exclVat"
                ? `${formatCurrency(detail.amount)} ekskl. moms`
                : `${formatCurrency(detail.amountInclVat)} inkl. moms`}
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<FileText className="h-3 w-3" />}
              onClick={() => window.open(detail.invoicePdf)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Vis PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50/80 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="h-9 w-full rounded-full border border-slate-200 bg-white/80 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Søg på kundenavn, domæne eller reference..."
            value={customerSearch}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              resetToFirstPage();
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs sm:mt-0 sm:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            {wlOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setWlFilter(option.value);
                  resetToFirstPage();
                }}
                className={`inline-flex items-center rounded-full border px-3 py-1 transition-colors ${
                  wlFilter === option.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white/60 text-slate-600 hover:border-blue-400 hover:text-blue-700"
                }`}
              >
                {option.label === "WL 1" ? (
                  <span>ipnordic</span>
                ) : option.label === "WL 71" ? (
                  <span>Enreach København</span>
                ) : option.label === "WL 74" ? (
                  <span>Enreach Hjørring</span>
                ) : (
                  option.label
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-2 py-1 text-[11px] text-slate-600">
            <span>Pr. side</span>
            <select
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                resetToFirstPage();
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {tenantCards.length > 0 ? (
        <>
          <div className="space-y-4">{tenantCards}</div>
          <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Viser {showingFrom}-{showingTo} af {totalCustomers} kunder
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => {
                    const normalized = Math.min(prev, totalPages);
                    return Math.max(normalized - 1, 1);
                  })
                }
                disabled={safePage <= 1 || totalCustomers === 0}
                className={`rounded-full border px-3 py-1 font-medium ${
                  safePage <= 1 || totalCustomers === 0
                    ? "cursor-not-allowed border-slate-100 text-slate-300"
                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700"
                }`}
              >
                Forrige
              </button>
              <span className="px-2 py-1 text-[11px] font-semibold text-slate-500">
                Side {totalCustomers === 0 ? 0 : safePage} /{" "}
                {totalCustomers === 0 ? 0 : totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => {
                    const normalized = Math.min(prev, totalPages);
                    return Math.min(normalized + 1, totalPages);
                  })
                }
                disabled={safePage >= totalPages || totalCustomers === 0}
                className={`rounded-full border px-3 py-1 font-medium ${
                  safePage >= totalPages || totalCustomers === 0
                    ? "cursor-not-allowed border-slate-100 text-slate-300"
                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700"
                }`}
              >
                Næste
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Ingen tenant-opdeling er tilgængelig for denne faktura.
        </p>
      )}
    </div>
  );
};

export default InvoiceDetailPage;
