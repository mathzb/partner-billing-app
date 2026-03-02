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
  FileSearch,
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
import { copyToClipboard } from "../utils/clipboard";

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
        await copyToClipboard(tableText);
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
        className={`overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md ${
          isReferenceMissing
            ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:ring-amber-900"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {customer.name}
            </h2>
            {customer.domains.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {customer.domains.join(", ")}
              </p>
            )}
            {customer.references.length > 0 ? (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Ref.: {customer.references.join(", ")}
              </p>
            ) : (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Reference mangler
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
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
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              I alt for tenant ({formatQuantityValue(totals.totalLicenses)}{" "}
              enheder)
            </p>
            <div className="mt-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Klik på en lev. for at kopiere
            </div>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Leverandør
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Licenser
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Beløb
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
                    <tr className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 align-top whitespace-normal">
                        <div className="flex w-full items-start justify-between gap-3">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={`${key}-details`}
                            className="flex flex-1 items-start justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                            onClick={() => toggleVendorExpansion(key)}
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {vendor.vendorName}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition-colors group-hover:border-slate-300 group-hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                              role="presentation"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" aria-hidden />
                              ) : (
                                <ChevronDown className="h-3 w-3" aria-hidden />
                              )}
                              {isExpanded ? "Skjul detaljer" : "Vis detaljer"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleCopyVendor(customer, vendor, vendorCopyKey);
                            }}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition-all hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
                          >
                            {vendorCopyState === "copied"
                              ? "Kopieret"
                              : vendorCopyState === "error"
                                ? "Fejl"
                                : "Kopier"}
                          </button>
                        </div>
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
                      <td className="px-4 py-2.5 text-right align-top">
                        <div className="flex flex-col items-end text-[11px]">
                          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {formatQuantityValue(vendor.totalLicenses)}
                          </span>
                          <span className="uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {translateQuantityLabel(quantityLabel)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right align-top font-mono font-semibold text-slate-800 dark:text-slate-200">
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
                      <tr
                        className="bg-slate-50/70 dark:bg-slate-800/30"
                        id={`${key}-details`}
                      >
                        <td colSpan={3} className="px-4 pb-4">
                          <div className="overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 shadow-inner dark:border-blue-900 dark:from-slate-900 dark:to-blue-950/30">
                            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 bg-blue-100/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
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
                              const canShowDetails = detailEntries.length > 1;
                              const isProductDetailsExpanded =
                                expandedProductDetails.has(productDetailsKey);

                              return (
                                <Fragment key={`${key}-${product.displayName}`}>
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-t border-blue-100/70 bg-white/80 px-3 py-2 text-[12px] text-slate-700 transition-colors hover:bg-blue-50/70 dark:border-blue-900/50 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-blue-950/30">
                                    <div>
                                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
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
                                          className="w-20 rounded-lg border border-blue-200 bg-white px-2 py-1 text-right text-[11px] font-semibold text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300"
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
                                        className="border-t border-blue-100/70 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20"
                                      >
                                        {/* Table header */}
                                        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 bg-blue-100/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                                          <span>Fakturering + Binding</span>
                                          <span className="text-right">
                                            Licenser
                                          </span>
                                          <span className="text-right">
                                            Kostpris
                                          </span>
                                          <span className="text-right">
                                            Listepris
                                          </span>
                                          <span className="text-right">
                                            Beskrivelse
                                          </span>
                                        </div>
                                        <div className="divide-y divide-blue-100/60 dark:divide-blue-900/40">
                                          {detailEntries.map((detail) => {
                                            const detailKey = `${detail.label}-${detail.billing ?? "none"}-${detail.commitment ?? "none"}`;
                                            const billingDiffers =
                                              detail.billing &&
                                              product.billing &&
                                              detail.billing.toLowerCase() !==
                                                product.billing.toLowerCase();
                                            const commitmentDiffers =
                                              detail.commitment &&
                                              product.commitment &&
                                              detail.commitment.toLowerCase() !==
                                                product.commitment.toLowerCase();
                                            const hasDiff =
                                              billingDiffers ||
                                              commitmentDiffers;
                                            const costAmt = detail.amount ?? 0;
                                            const retailAmt =
                                              detail.retailAmount ?? 0;
                                            const detailDiscountAmt =
                                              (retailAmt * discountRate) / 100;
                                            const detailDiscountedRetail =
                                              retailAmt - detailDiscountAmt;
                                            return (
                                              <div
                                                key={`${productDetailsKey}-${detailKey}`}
                                                className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 px-4 py-2 text-[11px] ${
                                                  hasDiff
                                                    ? "bg-amber-50/80 dark:bg-amber-950/20"
                                                    : "bg-white/50 dark:bg-slate-800/20"
                                                }`}
                                              >
                                                {/* Col 1: Billing + Commitment badges */}
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                  <span
                                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                                      billingDiffers
                                                        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-300"
                                                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                                    }`}
                                                  >
                                                    {translateBillingFrequency(
                                                      detail.billing,
                                                    )}{" "}
                                                    betaling
                                                  </span>
                                                  <span className="text-[10px] text-slate-400">
                                                    +
                                                  </span>
                                                  <span
                                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                                      commitmentDiffers
                                                        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-300"
                                                        : "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300"
                                                    }`}
                                                  >
                                                    {translateCommitmentTerm(
                                                      detail.commitment,
                                                    )}{" "}
                                                    binding
                                                  </span>
                                                </div>
                                                {/* Col 2: Licence count */}
                                                <div className="text-right">
                                                  <span className="inline-flex min-w-[2.5rem] justify-center rounded-full bg-blue-600 px-2.5 py-0.5 font-mono text-[12px] font-bold text-white shadow-sm dark:bg-blue-700">
                                                    {formatLicenseCountLabel(
                                                      detail.licenses,
                                                    )}
                                                  </span>
                                                </div>
                                                {/* Col 3: Cost */}
                                                <div className="text-right font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                  {formatCurrency(costAmt)}
                                                </div>
                                                {/* Col 4: Retail / list price */}
                                                <div className="text-right font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                                  {hasDiscount ? (
                                                    <div className="flex flex-col items-end leading-tight">
                                                      <span className="text-[10px] text-slate-400 line-through">
                                                        {formatCurrency(
                                                          retailAmt,
                                                        )}
                                                      </span>
                                                      <span>
                                                        {formatCurrency(
                                                          detailDiscountedRetail,
                                                        )}
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    formatCurrency(retailAmt)
                                                  )}
                                                </div>
                                                {/* Col 5: Description (secondary) */}
                                                <div
                                                  className="truncate text-right text-[10px] text-slate-400 dark:text-slate-500"
                                                  title={detail.label}
                                                >
                                                  {detail.label}
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
                <tr className="border-t border-slate-200 bg-slate-50/60 font-semibold dark:border-slate-700 dark:bg-slate-800/40">
                  <td className="px-4 py-2 text-right text-xs text-slate-600 dark:text-slate-400">
                    I alt
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800 dark:text-slate-200">
                    {totals.totalLicenses}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800 dark:text-slate-200">
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
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-4" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-40" />
            </div>
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
        {[...Array(3)].map((_, idx) => (
          <Skeleton key={idx} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center dark:border-rose-800 dark:bg-rose-950/40">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/60">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        </span>
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
          Kunne ikke hente fakturaoplysninger
        </p>
        <p className="text-xs text-rose-600 dark:text-rose-400">
          Prøv at genindlæse siden.
        </p>
      </div>
    );
  }

  const detailStatusCfg = {
    overdue: {
      dot: "bg-rose-500",
      badge:
        "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:ring-rose-900",
      label: "Forfalden",
    },
    paid: {
      dot: "bg-emerald-500",
      badge:
        "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-900",
      label: "Betalt",
    },
    unpaid: {
      dot: "bg-amber-500",
      badge:
        "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-900",
      label: "Ubetalt",
    },
  };
  const detailStatusKey =
    detail.status.toLowerCase() as keyof typeof detailStatusCfg;
  const invoiceStatusBadge = detailStatusCfg[detailStatusKey] ?? {
    dot: "bg-slate-400",
    badge:
      "bg-slate-50 text-slate-600 ring-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
    label: detail.status,
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
        aria-label="Brødkrumme"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-medium text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Fakturaer
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {detail.invoiceNumber}
        </span>
      </nav>

      {/* Invoice header card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Faktura {detail.invoiceNumber}
            </h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Udstedt{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {new Date(detail.postingDate).toLocaleDateString("da-DK", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </span>
              <span>
                Forfalder{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {new Date(detail.dueDate).toLocaleDateString("da-DK", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${invoiceStatusBadge.badge}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${invoiceStatusBadge.dot}`}
                aria-hidden
              />
              {invoiceStatusBadge.label}
            </span>
            <p className="tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
              {amountDisplayMode === "exclVat"
                ? formatCurrency(detail.amount)
                : formatCurrency(detail.amountInclVat)}
            </p>
            {amountDisplayMode === "both" && (
              <p className="tabular text-sm font-semibold text-slate-500 dark:text-slate-400">
                {formatCurrency(detail.amount)}{" "}
                <span className="text-xs font-normal">ekskl. moms</span>
              </p>
            )}
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {amountDisplayMode === "exclVat" ? "ekskl. moms" : "inkl. moms"}
            </p>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FileText className="h-3.5 w-3.5" />}
              onClick={() => window.open(detail.invoicePdf)}
            >
              Vis PDF
            </Button>
          </div>
        </div>
      </section>

      {/* Customer filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-700"
              placeholder="Søg kunde, domæne eller reference…"
              value={customerSearch}
              onChange={(event) => {
                setCustomerSearch(event.target.value);
                resetToFirstPage();
              }}
              aria-label="Søg kunder"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <label htmlFor="pageSize" className="font-medium">
              Pr. side
            </label>
            <select
              id="pageSize"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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

        {wlOptions.length > 1 && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filtrer WL-kode"
          >
            {wlOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setWlFilter(option.value);
                  resetToFirstPage();
                }}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  wlFilter === option.value
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {option.label === "WL 1"
                  ? "ipnordic"
                  : option.label === "WL 71"
                    ? "Enreach København"
                    : option.label === "WL 74"
                      ? "Enreach Hjørring"
                      : option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tenantCards.length > 0 ? (
        <>
          <div className="space-y-4">{tenantCards}</div>
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Viser{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {showingFrom}–{showingTo}
              </span>{" "}
              af{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {totalCustomers}
              </span>{" "}
              kunder
            </p>
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400 dark:disabled:border-slate-800 dark:disabled:text-slate-600"
              >
                ← Forrige
              </button>
              <span className="min-w-[4.5rem] text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                {totalCustomers === 0 ? "0 / 0" : `${safePage} / ${totalPages}`}
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400 dark:disabled:border-slate-800 dark:disabled:text-slate-600"
              >
                Næste →
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-14 text-center dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <FileSearch className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Ingen tenant-opdeling tilgængelig
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Denne faktura har ikke nogen underliggende tenants.
          </p>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetailPage;
