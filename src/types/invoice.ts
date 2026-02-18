// src/types/invoice.ts
export interface Invoice {
  invoiceNumber: string;
  postingDate: string;
  amount: number;
  amountInclVat: number;
  dueDate: string;
  status: "Paid" | "Unpaid" | "Overdue";
  invoicePdf: string;
  billingDataExcel: string;
}

export interface InvoiceTenantEntry {
  productId: string;
  skuId: string;
  description: string;
  nickname: string;
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
}

export interface InvoiceSubscriptionBreakdown {
  id: string;
  description: string;
  nickname: string;
  licensQuantity: number;
  amount: number;
  retailAmount: number;
  billingTypeId?: string;
  billingTypeDescription?: string;
  entries: InvoiceTenantEntry[];
}

export interface InvoiceTenantBreakdown {
  id: string;
  name: string;
  domain: string;
  amount: number;
  retailAmount: number;
  customerName: string;
  customerVatId: string;
  customerReference: string;
  subscriptions: InvoiceSubscriptionBreakdown[];
}

export interface InvoiceDetailLine {
  description: string;
  amount: number;
  billingTypeId?: string;
  billingTypeDescription?: string;
}

export interface InvoiceDetail extends Invoice {
  customerName: string;
  lines: InvoiceDetailLine[];
  // Detailed breakdown of which tenants/customers pay for which licenses
  tenants?: InvoiceTenantBreakdown[];
}

export interface InvoiceType {
  id: string;
  description: string;
}
