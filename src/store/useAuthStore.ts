// src/store/useAuthStore.ts
import { create } from "zustand";

interface AuthState {
  accessToken: string;
  refreshToken: string;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}

const runtimeConfig = window.__APP_CONFIG__;

export const useAuthStore = create<AuthState>((set) => ({
  accessToken:
    runtimeConfig?.VITE_ACCESS_TOKEN ?? import.meta.env.VITE_ACCESS_TOKEN ?? "",
  refreshToken:
    runtimeConfig?.VITE_REFRESH_TOKEN ??
    import.meta.env.VITE_REFRESH_TOKEN ??
    "",
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  logout: () => set({ accessToken: "", refreshToken: "" }),
}));
