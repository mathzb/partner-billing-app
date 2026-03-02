// src/store/useDarkModeStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DarkModeState {
  isDark: boolean;
  toggle: () => void;
}

const applyDarkClass = (isDark: boolean) => {
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

export const useDarkModeStore = create<DarkModeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () =>
        set((state) => {
          const next = !state.isDark;
          applyDarkClass(next);
          return { isDark: next };
        }),
    }),
    {
      name: "partner-billing-dark-mode",
      onRehydrateStorage: () => (state) => {
        if (state?.isDark) {
          applyDarkClass(true);
        }
      },
    },
  ),
);
