import { create } from "zustand";

export type AmountDisplayMode = "inclVat" | "exclVat" | "both";

const STORAGE_KEY = "amountDisplayMode";

const isAmountDisplayMode = (
  value: string | null,
): value is AmountDisplayMode =>
  value === "inclVat" || value === "exclVat" || value === "both";

const getInitialMode = (): AmountDisplayMode => {
  if (typeof window === "undefined") return "both";
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (isAmountDisplayMode(storedValue)) {
      return storedValue;
    }
  } catch {
    return "both";
  }
  return "both";
};

const persistMode = (mode: AmountDisplayMode) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    return;
  }
};

interface AmountDisplayState {
  mode: AmountDisplayMode;
  setMode: (mode: AmountDisplayMode) => void;
}

export const useAmountDisplayStore = create<AmountDisplayState>((set) => ({
  mode: getInitialMode(),
  setMode: (mode) => {
    persistMode(mode);
    set({ mode });
  },
}));
