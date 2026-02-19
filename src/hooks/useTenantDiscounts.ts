import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type TenantProductDiscounts = Record<string, number>;
export type TenantDiscountState = Record<string, TenantProductDiscounts>;

type UpsertDiscountPayload = {
  tenantId: string;
  vendorName: string;
  productName: string;
  rate: number;
};

type DeleteDiscountPayload = {
  tenantId: string;
  vendorName: string;
  productName: string;
};

const DISCOUNTS_API_URL = "/api/tenant-discounts";
const DISCOUNTS_QUERY_KEY = ["tenant-discounts"] as const;

const clampRate = (value: number) => Math.min(100, Math.max(0, value));

const makeProductKey = (vendorName: string, productName: string) =>
  `${vendorName ?? "vendor"}::${productName ?? "product"}`.toLowerCase();

const parseDiscountPayload = (payload: unknown): TenantDiscountState => {
  if (!payload || typeof payload !== "object") return {};

  const typed = payload as { discounts?: unknown };
  if (!typed.discounts || typeof typed.discounts !== "object") return {};

  return typed.discounts as TenantDiscountState;
};

const fetchDiscounts = async (): Promise<TenantDiscountState> => {
  const response = await fetch(DISCOUNTS_API_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Kunne ikke hente rabatter (status ${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  return parseDiscountPayload(payload);
};

const upsertDiscount = async (payload: UpsertDiscountPayload) => {
  const response = await fetch(DISCOUNTS_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Kunne ikke gemme rabat (status ${response.status})`);
  }
};

const deleteDiscount = async (payload: DeleteDiscountPayload) => {
  const response = await fetch(DISCOUNTS_API_URL, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Kunne ikke slette rabat (status ${response.status})`);
  }
};

export const useTenantDiscounts = () => {
  const queryClient = useQueryClient();
  const { data: discounts = {} } = useQuery<TenantDiscountState>({
    queryKey: DISCOUNTS_QUERY_KEY,
    queryFn: fetchDiscounts,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const getDiscountRate = useCallback(
    (tenantId: string | undefined, vendorName: string, productName: string) => {
      if (!tenantId) return undefined;
      const productKey = makeProductKey(vendorName, productName);
      return discounts[tenantId]?.[productKey];
    },
    [discounts],
  );

  const setDiscountRate = useCallback(
    (
      tenantId: string | undefined,
      vendorName: string,
      productName: string,
      rate: number | null,
    ) => {
      if (!tenantId) return;
      const productKey = makeProductKey(vendorName, productName);
      const normalizedRate =
        rate === null || Number.isNaN(rate)
          ? null
          : Math.round(clampRate(rate) * 100) / 100;

      queryClient.setQueryData<TenantDiscountState>(
        DISCOUNTS_QUERY_KEY,
        (prev = {}) => {
          const tenantDiscounts = prev[tenantId] ?? {};
          if (normalizedRate === null) {
            if (!(productKey in tenantDiscounts)) return prev;
            const restProducts = { ...tenantDiscounts };
            delete restProducts[productKey];
            const next = { ...prev };
            if (Object.keys(restProducts).length === 0) {
              delete next[tenantId];
            } else {
              next[tenantId] = restProducts;
            }
            return next;
          }

          return {
            ...prev,
            [tenantId]: {
              ...tenantDiscounts,
              [productKey]: normalizedRate,
            },
          };
        },
      );

      const payload = {
        tenantId,
        vendorName,
        productName,
      };

      const persist =
        normalizedRate === null
          ? deleteDiscount(payload)
          : upsertDiscount({
              ...payload,
              rate: normalizedRate,
            });

      void persist.catch((error) => {
        console.warn("Kunne ikke gemme rabat i databasen", error);
        void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
      });
    },
    [queryClient],
  );

  return {
    getDiscountRate,
    setDiscountRate,
  };
};
