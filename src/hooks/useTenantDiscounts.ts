import { useCallback, useEffect, useState } from "react";

export type TenantProductDiscounts = Record<string, number>;
export type TenantDiscountState = Record<string, TenantProductDiscounts>;

const STORAGE_KEY = "tenantProductDiscounts";

const clampRate = (value: number) => Math.min(100, Math.max(0, value));

const makeProductKey = (vendorName: string, productName: string) =>
  `${vendorName ?? "vendor"}::${productName ?? "product"}`.toLowerCase();

const readStorage = (): TenantDiscountState => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as TenantDiscountState;
    }
  } catch (error) {
    console.warn("Failed to parse tenant discount storage", error);
  }
  return {};
};

const writeStorage = (value: TenantDiscountState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to persist tenant discounts", error);
  }
};

export const useTenantDiscounts = () => {
  const [discounts, setDiscounts] = useState<TenantDiscountState>(() =>
    readStorage(),
  );

  useEffect(() => {
    writeStorage(discounts);
  }, [discounts]);

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
      setDiscounts((prev) => {
        const tenantDiscounts = prev[tenantId] ?? {};
        if (rate === null || Number.isNaN(rate)) {
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

        const normalized = Math.round(clampRate(rate) * 100) / 100;
        const next = {
          ...prev,
          [tenantId]: {
            ...tenantDiscounts,
            [productKey]: normalized,
          },
        };
        return next;
      });
    },
    [setDiscounts],
  );

  return {
    getDiscountRate,
    setDiscountRate,
  };
};
