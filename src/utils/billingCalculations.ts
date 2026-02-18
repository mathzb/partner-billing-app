// src/utils/billingCalculations.ts
import type {
  Invoice,
  InvoiceTenantBreakdown,
  InvoiceSubscriptionBreakdown,
} from "../types/invoice";

export type BillingMetrics = {
  totalInvoiced: number;
  balanceDue: number;
  overdueAmount: number;
  currentMonthVolume: number;
  paidThisMonth: number;
  averageInvoice: number;
  openInvoiceCount: number;
};

export type BillingAmountMode = "inclVat" | "exclVat";

const getIsoMonth = (value: string) => value.slice(0, 7);

export const calculateBillingMetrics = (
  invoices: Invoice[] | null | undefined = [],
  amountMode: BillingAmountMode = "inclVat",
): BillingMetrics => {
  const safeInvoices: Invoice[] = Array.isArray(invoices) ? invoices : [];
  const now = new Date();
  const currentMonthIso = getIsoMonth(now.toISOString());

  const aggregate = safeInvoices.reduce(
    (acc, inv) => {
      const amount =
        amountMode === "inclVat"
          ? (inv.amountInclVat ?? inv.amount ?? 0)
          : (inv.amount ?? inv.amountInclVat ?? 0);
      acc.totalInvoiced += amount;
      acc.invoiceCount += 1;
      acc.invoiceAmountSum += amount;

      const isOpen = inv.status === "Unpaid" || inv.status === "Overdue";
      if (isOpen) {
        acc.balanceDue += amount;
        acc.openInvoiceCount += 1;
      }

      if (inv.status === "Overdue") {
        acc.overdueAmount += amount;
      }

      const invoiceMonth = getIsoMonth(inv.postingDate);
      if (invoiceMonth === currentMonthIso) {
        acc.currentMonthVolume += amount;
        if (inv.status === "Paid") {
          acc.paidThisMonth += amount;
        }
      }

      return acc;
    },
    {
      totalInvoiced: 0,
      balanceDue: 0,
      overdueAmount: 0,
      currentMonthVolume: 0,
      paidThisMonth: 0,
      openInvoiceCount: 0,
      invoiceAmountSum: 0,
      invoiceCount: 0,
    },
  );

  return {
    totalInvoiced: aggregate.totalInvoiced,
    balanceDue: aggregate.balanceDue,
    overdueAmount: aggregate.overdueAmount,
    currentMonthVolume: aggregate.currentMonthVolume,
    paidThisMonth: aggregate.paidThisMonth,
    openInvoiceCount: aggregate.openInvoiceCount,
    averageInvoice:
      aggregate.invoiceCount > 0
        ? aggregate.invoiceAmountSum / aggregate.invoiceCount
        : 0,
  };
};

export type AgingBuckets = {
  "0-30": number;
  "31-60": number;
  "61-90": number;
  "90+": number;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const diffInDays = (from: Date, toIso: string) => {
  const due = new Date(toIso);
  const diff = from.getTime() - due.getTime();
  return Math.floor(diff / MS_PER_DAY);
};

export const calculateAgingBuckets = (
  invoices: Invoice[] | null | undefined = [],
  referenceDate: Date = new Date(),
): AgingBuckets => {
  const safeInvoices: Invoice[] = Array.isArray(invoices) ? invoices : [];

  return safeInvoices.reduce(
    (buckets, invoice) => {
      if (invoice.status === "Paid") return buckets;
      const daysPastDue = diffInDays(referenceDate, invoice.dueDate);

      if (daysPastDue <= 30) {
        buckets["0-30"] += invoice.amountInclVat;
      } else if (daysPastDue <= 60) {
        buckets["31-60"] += invoice.amountInclVat;
      } else if (daysPastDue <= 90) {
        buckets["61-90"] += invoice.amountInclVat;
      } else {
        buckets["90+"] += invoice.amountInclVat;
      }

      return buckets;
    },
    { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
  );
};

const stripNcePrefix = (label: string) =>
  label.replace(/^\(\s*NCE\s*\)\s*/i, "");

const formatProductLabel = (label: string) => {
  const trimmed = label.trim();
  const withoutPrefix = stripNcePrefix(trimmed).trim();
  return withoutPrefix.length > 0 ? withoutPrefix : trimmed;
};

const normalizeLabel = (label: string) =>
  formatProductLabel(label).replace(/\s+/g, " ").trim().toLowerCase();

const identifyVendorFromProduct = (productLabel: string) => {
  const normalized = productLabel.toLowerCase();
  if (normalized.includes("exclaimer")) return "Exclaimer";
  if (normalized.includes("keepit")) return "Keepit";
  if (normalized.includes("adobe")) return "Adobe";
  if (normalized.includes("microsoft")) return "Microsoft";
  return undefined;
};

const shouldUseRetailAmount = (vendorName: string) => {
  const normalized = vendorName.toLowerCase();
  return (
    normalized.includes("keepit") ||
    normalized.includes("adobe") ||
    normalized.includes("microsoft")
  );
};

const getAmountForVendor = (
  sub: InvoiceSubscriptionBreakdown,
  vendorName: string,
) => {
  const prefersRetail = shouldUseRetailAmount(vendorName);
  const hasRetail = typeof sub.retailAmount === "number";
  const hasAmount = typeof sub.amount === "number";

  if (prefersRetail) {
    if (hasRetail) return sub.retailAmount as number;
    if (hasAmount) return sub.amount as number;
    return 0;
  }

  if (hasAmount) return sub.amount as number;
  if (hasRetail) return sub.retailAmount as number;
  return 0;
};

export type AggregatedVendor = {
  vendorName: string;
  totalLicenses: number;
  totalAmount: number;
  products: Array<{
    displayName: string;
    licenses: number;
    amount: number;
    costAmount: number;
    billing?: string;
    commitment?: string;
    details: Array<{
      label: string;
      billing?: string;
      commitment?: string;
      licenses: number;
      amount: number;
    }>;
  }>;
};

export const aggregateVendorsFromSubscriptions = (
  subscriptions: InvoiceTenantBreakdown["subscriptions"] | undefined,
): AggregatedVendor[] => {
  const vendorMap = new Map<
    string,
    {
      vendorName: string;
      totalLicenses: number;
      totalAmount: number;
      productsMap: Map<
        string,
        {
          displayName: string;
          licenses: number;
          amount: number;
          costAmount: number;
          billingValues: Set<string>;
          commitmentValues: Set<string>;
          detailsMap: Map<
            string,
            {
              label: string;
              billing?: string;
              commitment?: string;
              licenses: number;
              amount: number;
            }
          >;
        }
      >;
    }
  >();

  (subscriptions ?? []).forEach((sub: InvoiceSubscriptionBreakdown) => {
    const vendorName =
      sub.billingTypeDescription?.trim() ||
      identifyVendorFromProduct(sub.description || sub.nickname || "Product") ||
      sub.nickname ||
      sub.description ||
      "Product";
    const rawProductLabel = (
      sub.description ||
      sub.nickname ||
      "Line item"
    ).trim();
    const productLabel = formatProductLabel(rawProductLabel);
    const productKey = normalizeLabel(productLabel);

    const vendorEntry = vendorMap.get(vendorName) ?? {
      vendorName,
      totalLicenses: 0,
      totalAmount: 0,
      productsMap: new Map(),
    };

    const effectiveAmount = getAmountForVendor(sub, vendorName);
    const licenses = sub.licensQuantity ?? 0;

    vendorEntry.totalLicenses += licenses;
    vendorEntry.totalAmount += effectiveAmount;

    const productEntry = vendorEntry.productsMap.get(productKey) ?? {
      displayName: productLabel,
      licenses: 0,
      amount: 0,
      costAmount: 0,
      billingValues: new Set<string>(),
      commitmentValues: new Set<string>(),
      detailsMap: new Map(),
    };

    productEntry.licenses += licenses;
    productEntry.amount += effectiveAmount;
    const subCostAmount = typeof sub.amount === "number" ? sub.amount : 0;
    let subscriptionEntryAmount = 0;

    (sub.entries ?? []).forEach((entry) => {
      if (entry.billing) productEntry.billingValues.add(entry.billing);
      if (entry.commitment) productEntry.commitmentValues.add(entry.commitment);

      const detailLabel = entry.description?.trim() || productLabel;
      const detailKey = `${detailLabel}|${entry.billing ?? ""}|${entry.commitment ?? ""}`;
      const detailEntry = productEntry.detailsMap.get(detailKey) ?? {
        label: detailLabel,
        billing: entry.billing || undefined,
        commitment: entry.commitment || undefined,
        licenses: 0,
        amount: 0,
      };
      const entryLicenses =
        entry.licensQuantity ?? entry.quantity ?? entry.days ?? 0;
      detailEntry.licenses += entryLicenses;
      const entryAmount = typeof entry.amount === "number" ? entry.amount : 0;
      detailEntry.amount += entryAmount;
      subscriptionEntryAmount += entryAmount;
      productEntry.detailsMap.set(detailKey, detailEntry);
    });

    const costContribution =
      subscriptionEntryAmount > 0 ? subscriptionEntryAmount : subCostAmount;
    productEntry.costAmount += costContribution;

    vendorEntry.productsMap.set(productKey, productEntry);
    vendorMap.set(vendorName, vendorEntry);
  });

  const resolveLabel = (values: Set<string>) => {
    if (!values || values.size === 0) return undefined;
    const normalized = Array.from(values).map((value) => value.trim());
    const unique = Array.from(new Set(normalized));
    return unique.length === 1 ? unique[0] : "Mixed";
  };

  return Array.from(vendorMap.values())
    .map((vendor) => ({
      vendorName: vendor.vendorName,
      totalLicenses: vendor.totalLicenses,
      totalAmount: vendor.totalAmount,
      products: Array.from(vendor.productsMap.values())
        .map((product) => ({
          displayName: product.displayName,
          licenses: product.licenses,
          amount: product.amount,
          costAmount: product.costAmount,
          billing: resolveLabel(product.billingValues),
          commitment: resolveLabel(product.commitmentValues),
          details: Array.from(product.detailsMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label, "da"),
          ),
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, "da")),
    }))
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName, "da"));
};
