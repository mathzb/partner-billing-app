// src/store/useAuthStore.ts
import { create } from "zustand";

interface AuthState {
  accessToken: string;
  refreshToken: string;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: import.meta.env.VITE_ACCESS_TOKEN ?? "",
  refreshToken: import.meta.env.VITE_REFRESH_TOKEN ?? "",
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  logout: () => set({ accessToken: "", refreshToken: "" }),
}));
