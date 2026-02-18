// src/hooks/useInvoices.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { Invoice } from "../types/invoice";

const PARTNER_GUID = "885a11b7-e83a-4e6a-8656-e01de8dddbfb";

type ApiInvoice = {
  invoiceNo: string;
  postingDate: string;
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
    description: string;
    lineAmount: number;
    billingDataExcel?: string | null;
  }>;
};

type InvoicesApiResponse = {
  partner: {
    no: string;
    name: string;
    balance: number;
    balanceDue: number;
  };
  invoices: ApiInvoice[];
};

const mapStatus = (inv: ApiInvoice): Invoice["status"] => {
  if (inv.remainingAmountIncludingVAT === 0) return "Paid";

  // Dates are in ISO yyyy-MM-dd, so string comparison is safe
  const today = new Date().toISOString().slice(0, 10);
  return inv.dueDate < today ? "Overdue" : "Unpaid";
};

const mapInvoice = (inv: ApiInvoice): Invoice => ({
  invoiceNumber: inv.invoiceNo,
  postingDate: inv.postingDate,
  amount: inv.amount,
  amountInclVat: inv.amountIncludingVAT,
  dueDate: inv.dueDate,
  status: mapStatus(inv),
  invoicePdf: inv.invoicePdf,
  billingDataExcel: inv.lines[0]?.billingDataExcel ?? "",
});

export const useInvoices = () => {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data } = await apiClient.get<InvoicesApiResponse>(
        `/accounts/${PARTNER_GUID}/invoices`,
      );
      return data.invoices
        .map(mapInvoice)
        .sort((a, b) => (a.postingDate < b.postingDate ? 1 : -1));
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
    placeholderData: (previousData) => previousData,
  });
};
