import { describe, expect, it } from "vitest";
import {
  aggregateVendorsFromSubscriptions,
  calculateAgingBuckets,
  calculateBillingMetrics,
} from "./billingCalculations";
import type { Invoice, InvoiceSubscriptionBreakdown } from "../types/invoice";

const buildInvoice = (overrides: Partial<Invoice>): Invoice => ({
  invoiceNumber: "INV-000",
  postingDate: "2026-01-01",
  amount: 1000,
  amountInclVat: 1250,
  dueDate: "2026-01-15",
  status: "Unpaid",
  invoicePdf: "",
  billingDataExcel: "",
  ...overrides,
});

describe("calculateBillingMetrics", () => {
  it("summarizes totals, open balance, and averages", () => {
    const invoices: Invoice[] = [
      buildInvoice({
        status: "Paid",
        postingDate: "2026-02-01",
        amountInclVat: 1000,
      }),
      buildInvoice({
        invoiceNumber: "INV-002",
        status: "Overdue",
        postingDate: "2025-12-15",
        dueDate: "2026-01-01",
        amountInclVat: 500,
      }),
      buildInvoice({
        invoiceNumber: "INV-003",
        status: "Unpaid",
        postingDate: new Date().toISOString().slice(0, 10),
        amountInclVat: 250,
      }),
    ];

    const metrics = calculateBillingMetrics(invoices);

    expect(metrics.totalInvoiced).toBe(1750);
    expect(metrics.balanceDue).toBe(750);
    expect(metrics.overdueAmount).toBe(500);
    expect(metrics.openInvoiceCount).toBe(2);
    expect(metrics.averageInvoice).toBeCloseTo(583.33, 1);
  });
});

describe("calculateAgingBuckets", () => {
  it("allocates unpaid invoices into correct buckets", () => {
    const today = new Date("2026-02-01T00:00:00Z");
    const invoices: Invoice[] = [
      buildInvoice({
        invoiceNumber: "0-15",
        dueDate: "2026-01-25",
        amountInclVat: 100,
        status: "Unpaid",
      }),
      buildInvoice({
        invoiceNumber: "45",
        dueDate: "2025-12-18",
        amountInclVat: 200,
        status: "Overdue",
      }),
      buildInvoice({
        invoiceNumber: "75",
        dueDate: "2025-11-20",
        amountInclVat: 300,
        status: "Overdue",
      }),
      buildInvoice({
        invoiceNumber: "120",
        dueDate: "2025-10-01",
        amountInclVat: 400,
        status: "Overdue",
      }),
      buildInvoice({
        invoiceNumber: "paid",
        status: "Paid",
        amountInclVat: 999,
      }),
    ];

    const aging = calculateAgingBuckets(invoices, today);

    expect(aging["0-30"]).toBe(100);
    expect(aging["31-60"]).toBe(200);
    expect(aging["61-90"]).toBe(300);
    expect(aging["90+"]).toBe(400);
  });
});

describe("aggregateVendorsFromSubscriptions", () => {
  it("consolidates duplicate product labels per vendor", () => {
    const subscriptions: InvoiceSubscriptionBreakdown[] = [
      {
        id: "sub-1",
        description: "Microsoft 365 E5",
        nickname: "Microsoft 365 E5",
        licensQuantity: 2,
        amount: 200,
        retailAmount: 200,
        billingTypeDescription: "Microsoft",
        entries: [],
      },
      {
        id: "sub-2",
        description: "Microsoft 365 E5",
        nickname: "Microsoft 365 E5",
        licensQuantity: 3,
        amount: 300,
        retailAmount: 300,
        billingTypeDescription: "Microsoft",
        entries: [],
      },
      {
        id: "sub-3",
        description: "Cisco Calling",
        nickname: "Cisco Calling",
        licensQuantity: 1,
        amount: 120,
        retailAmount: 0,
        billingTypeDescription: "Cisco",
        entries: [],
      },
    ];

    const vendors = aggregateVendorsFromSubscriptions(subscriptions);

    expect(vendors).toHaveLength(2);
    const microsoft = vendors.find(
      (vendor) => vendor.vendorName === "Microsoft",
    );
    expect(microsoft?.totalLicenses).toBe(5);
    expect(microsoft?.totalAmount).toBe(500);
    expect(microsoft?.products).toHaveLength(1);
    expect(microsoft?.products[0]).toMatchObject({
      displayName: "Microsoft 365 E5",
      licenses: 5,
      amount: 500,
    });
  });

  it("strips (NCE) prefixes before grouping", () => {
    const subscriptions: InvoiceSubscriptionBreakdown[] = [
      {
        id: "std",
        description: "Microsoft 365 E5",
        nickname: "Microsoft 365 E5",
        licensQuantity: 1,
        amount: 100,
        retailAmount: 100,
        billingTypeDescription: "Microsoft",
        entries: [],
      },
      {
        id: "nce",
        description: "(NCE) Microsoft 365 E5",
        nickname: "(NCE) Microsoft 365 E5",
        licensQuantity: 4,
        amount: 400,
        retailAmount: 400,
        billingTypeDescription: "Microsoft",
        entries: [],
      },
    ];

    const [microsoft] = aggregateVendorsFromSubscriptions(subscriptions);

    expect(microsoft.vendorName).toBe("Microsoft");
    expect(microsoft.totalLicenses).toBe(5);
    expect(microsoft.products).toHaveLength(1);
    expect(microsoft.products[0]).toMatchObject({
      displayName: "Microsoft 365 E5",
      licenses: 5,
      amount: 500,
    });
  });

  it("prefers retail amounts for Keepit, Adobe, and Microsoft vendors", () => {
    const subscriptions: InvoiceSubscriptionBreakdown[] = [
      {
        id: "keepit-1",
        description: "Keepit Backup",
        nickname: "Keepit Backup",
        licensQuantity: 2,
        amount: 50,
        retailAmount: 120,
        billingTypeDescription: "Keepit",
        entries: [],
      },
      {
        id: "keepit-2",
        description: "Keepit Backup",
        nickname: "Keepit Backup",
        licensQuantity: 1,
        amount: 25,
        retailAmount: 80,
        billingTypeDescription: "Keepit Cloud",
        entries: [],
      },
      {
        id: "other",
        description: "Other Product",
        nickname: "Other Product",
        licensQuantity: 1,
        amount: 10,
        retailAmount: 25,
        billingTypeDescription: "Contoso",
        entries: [],
      },
      {
        id: "adobe-1",
        description: "Adobe Creative Cloud",
        nickname: "Adobe Creative Cloud",
        licensQuantity: 5,
        amount: 200,
        retailAmount: 350,
        billingTypeDescription: "Adobe",
        entries: [],
      },
      {
        id: "m365",
        description: "Microsoft 365 Business",
        nickname: "M365 Biz",
        licensQuantity: 10,
        amount: 300,
        retailAmount: 450,
        billingTypeDescription: "Microsoft",
        entries: [],
      },
    ];

    const vendors = aggregateVendorsFromSubscriptions(subscriptions);
    const keepitVendors = vendors.filter((vendor) =>
      vendor.vendorName.toLowerCase().includes("keepit"),
    );
    const contoso = vendors.find((vendor) => vendor.vendorName === "Contoso");
    const adobe = vendors.find((vendor) =>
      vendor.vendorName.toLowerCase().includes("adobe"),
    );
    const microsoft = vendors.find((vendor) =>
      vendor.vendorName.toLowerCase().includes("microsoft"),
    );

    expect(keepitVendors).toHaveLength(2);
    expect(keepitVendors[0].totalAmount).toBe(120);
    expect(keepitVendors[0].products[0].amount).toBe(120);
    expect(keepitVendors[1].totalAmount).toBe(80);
    expect(keepitVendors[1].products[0].amount).toBe(80);
    expect(contoso?.totalAmount).toBe(10);
    expect(adobe?.totalAmount).toBe(350);
    expect(adobe?.products[0].amount).toBe(350);
    expect(microsoft?.totalAmount).toBe(450);
    expect(microsoft?.products[0].amount).toBe(450);
  });

  it("uses description as the product label", () => {
    const subscriptions: InvoiceSubscriptionBreakdown[] = [
      {
        id: "desc-first-1",
        description: "Description Only",
        nickname: "Nickname A",
        licensQuantity: 1,
        amount: 50,
        retailAmount: 0,
        billingTypeDescription: "Vendor",
        entries: [],
      },
      {
        id: "desc-first-2",
        description: "Description Only",
        nickname: "Nickname B",
        licensQuantity: 2,
        amount: 100,
        retailAmount: 0,
        billingTypeDescription: "Vendor",
        entries: [],
      },
    ];

    const [vendor] = aggregateVendorsFromSubscriptions(subscriptions);
    expect(vendor.products).toHaveLength(1);
    expect(vendor.products[0].displayName).toBe("Description Only");
    expect(vendor.products[0].licenses).toBe(3);
  });

  it("derives vendor from product label when billing type is missing", () => {
    const subscriptions: InvoiceSubscriptionBreakdown[] = [
      {
        id: "exclaimer-1",
        description: "Exclaimer Signatures",
        nickname: "Signature",
        licensQuantity: 10,
        amount: 100,
        retailAmount: 150,
        entries: [],
      },
    ];

    const [vendor] = aggregateVendorsFromSubscriptions(subscriptions);
    expect(vendor.vendorName).toBe("Exclaimer");
    expect(vendor.totalAmount).toBe(100);
  });
});
