// src/hooks/useInvoiceTypes.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { InvoiceType } from "../types/invoice";

const PARTNER_GUID = "885a11b7-e83a-4e6a-8656-e01de8dddbfb";

type InvoiceTypesResponse = {
  isSuccess: boolean;
  data: InvoiceType[];
  errorMessage: string | null;
};

export const useInvoiceTypes = () => {
  return useQuery({
    queryKey: ["invoiceTypes"],
    queryFn: async () => {
      const { data } = await apiClient.get<InvoiceTypesResponse>(
        `/accounts/${PARTNER_GUID}/invoices/invoicetypes`,
      );
      return data.data ?? [];
    },
  });
};
