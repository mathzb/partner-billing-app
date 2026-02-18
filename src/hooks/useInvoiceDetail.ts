// src/hooks/useInvoiceDetail.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { Invoice, InvoiceDetail } from "../types/invoice";

const PARTNER_GUID = "885a11b7-e83a-4e6a-8656-e01de8dddbfb";

type TenantEntryApi = {
  productId?: string;
  skuId?: string;
  description?: string;
  nickname?: string;
  licensQuantity?: number;
  invoicingType?: string;
  startDate?: string;
  endDate?: string;
  quantity?: number;
  days?: number;
  unitPrice?: number;
  retailUnitPrice?: number;
  amount?: number;
  retailAmount?: number;
  billing?: string;
  commitment?: string;
  billingStartDate?: string;
  billingEndDate?: string;
  commitmentStartDate?: string;
  commitmentEndDate?: string;
};

type TenantConnectorApi = {
  id?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  retailUnitPrice?: number;
  amount?: number;
  retailAmount?: number;
};

type InvoiceDetailApiResponse = {
  partner: {
    no: string;
    name: string;
    balance: number;
    balanceDue: number;
  };
  invoice: {
    id: string;
    invoiceNo: string;
    customerNo: string;
    postingDate: string;
    ts: number;
    type: string;
    amount: number;
    amountIncludingVAT: number;
    remainingAmountIncludingVAT: number;
    dueDate: string;
    currency: string;
    company: string;
    invoicePdf: string;
    periodStartDate: string;
    periodEndDate: string;
    lines: Array<{
      lineNo: number;
      description: string;
      lineAmount: number;
      billingTypeId?: string;
      billingTypeDescription: string;
      billingDataExcel?: string | null;
      billingData?: {
        amount: number;
        retailAmount: number;
        tenants?: Array<{
          id: string;
          name: string;
          domain: string;
          amount: number;
          retailAmount: number;
          customerId: string;
          customerName: string;
          customerVatId: string;
          customerReference: string;
          productId?: string;
          productDescription?: string;
          quantity?: number;
          unitPrice?: number;
          retailUnitPrice?: number;
          entries?: TenantEntryApi[];
          connectors?: TenantConnectorApi[];
          subscriptions?: Array<{
            id: string;
            description: string;
            nickname: string;
            licensQuantity: number;
            birthday: string;
            amount: number;
            retailAmount: number;
            promotionPercent: number;
            entries?: TenantEntryApi[];
          }>;
        }> | null;
      } | null;
    }>;
  };
};

const mapStatus = (
  remainingAmountIncludingVAT: number,
  dueDate: string,
): Invoice["status"] => {
  if (remainingAmountIncludingVAT === 0) return "Paid";

  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today ? "Overdue" : "Unpaid";
};

const mapInvoiceDetail = (api: InvoiceDetailApiResponse): InvoiceDetail => {
  const inv = api.invoice;

  const buildEntry = (
    entry: TenantEntryApi,
    fallbackId: string,
    fallbackDescription: string,
  ) => ({
    productId: entry.productId ?? fallbackId,
    skuId: entry.skuId ?? fallbackId,
    description: entry.description ?? fallbackDescription,
    nickname: entry.nickname ?? entry.description ?? fallbackDescription,
    licensQuantity: entry.licensQuantity ?? entry.quantity ?? 0,
    invoicingType: entry.invoicingType,
    startDate: entry.startDate,
    endDate: entry.endDate,
    quantity: entry.quantity,
    days: entry.days,
    unitPrice: entry.unitPrice,
    retailUnitPrice: entry.retailUnitPrice,
    amount: entry.amount ?? 0,
    retailAmount: entry.retailAmount ?? 0,
    billing: entry.billing,
    commitment: entry.commitment,
    billingStartDate: entry.billingStartDate,
    billingEndDate: entry.billingEndDate,
    commitmentStartDate: entry.commitmentStartDate,
    commitmentEndDate: entry.commitmentEndDate,
  });

  // Build tenant-level breakdown from billingData on each line (if present)
  const tenants = inv.lines.flatMap((line) => {
    const billingData = line.billingData;
    const lineTenants = billingData?.tenants ?? [];
    if (!lineTenants.length)
      return [] as InvoiceDetail["tenants"] extends Array<infer T>
        ? T[]
        : never[];

    return lineTenants.map((tenant) => {
      const mapSubscriptionEntries = (
        subEntries: TenantEntryApi[] | undefined,
        subId: string,
        subDescription: string,
      ) =>
        (subEntries ?? []).map((entry, idx) =>
          buildEntry(
            entry,
            entry.productId ?? entry.skuId ?? `${subId}-entry-${idx}`,
            entry.description ??
              entry.nickname ??
              subDescription ??
              "Line item",
          ),
        );

      const sumEntryLicenses = (entries: ReturnType<typeof buildEntry>[]) =>
        entries.reduce(
          (acc, entry) => acc + (entry.licensQuantity ?? entry.quantity ?? 0),
          0,
        );

      const mapSubscriptions = () => {
        if (tenant.subscriptions && tenant.subscriptions.length > 0) {
          return tenant.subscriptions.map((sub) => {
            const entries = mapSubscriptionEntries(
              sub.entries,
              sub.id,
              sub.description,
            );
            const derivedLicenses = sumEntryLicenses(entries);
            const fallbackLicenses =
              derivedLicenses || (entries.length > 0 ? entries.length : 0);

            return {
              id: sub.id,
              description: sub.description,
              nickname: sub.nickname,
              licensQuantity: sub.licensQuantity ?? fallbackLicenses,
              amount: sub.amount,
              retailAmount: sub.retailAmount,
              billingTypeId: line.billingTypeId,
              billingTypeDescription: line.billingTypeDescription,
              entries,
            };
          });
        }

        const directEntries = (tenant.entries ?? []).map((entry, idx) => {
          const description =
            entry.description ??
            entry.nickname ??
            tenant.productDescription ??
            line.description ??
            line.billingTypeDescription ??
            "Item";
          const fallbackId =
            entry.productId ?? entry.skuId ?? `${tenant.id}-entry-${idx}`;

          return {
            id: fallbackId,
            description,
            nickname: entry.nickname ?? description,
            licensQuantity: entry.licensQuantity ?? entry.quantity ?? 0,
            amount: entry.amount ?? 0,
            retailAmount: entry.retailAmount ?? 0,
            billingTypeId: line.billingTypeId,
            billingTypeDescription: line.billingTypeDescription,
            entries: [buildEntry(entry, fallbackId, description)],
          };
        });

        if (directEntries.length > 0) {
          return directEntries;
        }

        const connectorSubscriptions = (tenant.connectors ?? []).map(
          (connector, idx) => {
            const rawQuantity =
              connector.quantity ?? tenant.quantity ?? undefined;
            const rawUnitPrice =
              connector.unitPrice ?? tenant.unitPrice ?? undefined;
            const rawRetailUnitPrice =
              connector.retailUnitPrice ?? tenant.retailUnitPrice ?? undefined;

            const quantity = rawQuantity ?? 0;
            const unitPrice = rawUnitPrice ?? 0;
            const retailUnitPrice = rawRetailUnitPrice ?? 0;

            const amount =
              connector.amount ??
              (rawQuantity !== undefined && rawUnitPrice !== undefined
                ? quantity * unitPrice
                : 0);
            const retailAmount =
              connector.retailAmount ??
              (rawQuantity !== undefined && rawRetailUnitPrice !== undefined
                ? quantity * retailUnitPrice
                : 0);

            const description =
              connector.description ??
              tenant.productDescription ??
              line.description ??
              line.billingTypeDescription ??
              "Product";
            const fallbackId =
              connector.id ??
              tenant.productId ??
              `${tenant.id}-connector-${idx}`;

            const connectorEntry: TenantEntryApi = {
              productId: tenant.productId ?? connector.id,
              skuId: connector.id,
              description,
              nickname: description,
              licensQuantity: quantity,
              quantity,
              unitPrice,
              retailUnitPrice,
              amount,
              retailAmount,
            };

            return {
              id: fallbackId,
              description,
              nickname: description,
              licensQuantity: quantity,
              amount,
              retailAmount,
              billingTypeId: line.billingTypeId,
              billingTypeDescription: line.billingTypeDescription,
              entries: [buildEntry(connectorEntry, fallbackId, description)],
            };
          },
        );

        if (connectorSubscriptions.length > 0) {
          return connectorSubscriptions;
        }

        const fallbackDescription =
          tenant.productDescription ??
          line.description ??
          line.billingTypeDescription ??
          tenant.name ??
          "Item";
        const fallbackId = tenant.productId ?? tenant.id;

        return [
          {
            id: fallbackId,
            description: fallbackDescription,
            nickname: fallbackDescription,
            licensQuantity: tenant.quantity ?? 0,
            amount: tenant.amount ?? 0,
            retailAmount: tenant.retailAmount ?? 0,
            billingTypeId: line.billingTypeId,
            billingTypeDescription: line.billingTypeDescription,
            entries: [
              buildEntry(
                {
                  productId: tenant.productId,
                  description: fallbackDescription,
                  nickname: fallbackDescription,
                  licensQuantity: tenant.quantity,
                  quantity: tenant.quantity,
                  unitPrice: tenant.unitPrice,
                  retailUnitPrice: tenant.retailUnitPrice,
                  amount: tenant.amount,
                  retailAmount: tenant.retailAmount,
                },
                fallbackId,
                fallbackDescription,
              ),
            ],
          },
        ];
      };

      return {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        amount: tenant.amount ?? 0,
        retailAmount: tenant.retailAmount ?? 0,
        customerName: tenant.customerName,
        customerVatId: tenant.customerVatId,
        customerReference: tenant.customerReference,
        subscriptions: mapSubscriptions(),
      };
    });
  });

  return {
    invoiceNumber: inv.invoiceNo,
    postingDate: inv.postingDate,
    amount: inv.amount,
    amountInclVat: inv.amountIncludingVAT,
    dueDate: inv.dueDate,
    status: mapStatus(inv.remainingAmountIncludingVAT, inv.dueDate),
    invoicePdf: inv.invoicePdf,
    billingDataExcel: inv.lines[0]?.billingDataExcel ?? "",
    customerName: api.partner.name,
    lines: inv.lines.map((line) => ({
      description: line.description,
      amount: line.lineAmount,
      billingTypeId: line.billingTypeId,
      billingTypeDescription: line.billingTypeDescription,
    })),
    tenants: tenants.length ? tenants : undefined,
  };
};

export const useInvoiceDetail = (invoiceNo: string | null) => {
  return useQuery({
    queryKey: ["invoice", invoiceNo],
    queryFn: async () => {
      if (!invoiceNo) return null;
      const { data } = await apiClient.get<InvoiceDetailApiResponse>(
        `/accounts/${PARTNER_GUID}/invoices/${invoiceNo}`,
      );
      return mapInvoiceDetail(data);
    },
    enabled: !!invoiceNo, // Only run query if we have an ID
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
};
