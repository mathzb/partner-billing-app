// src/store/useAuthStore.ts
import { create } from "zustand";

interface AuthState {
  accessToken: string;
  refreshToken: string;
  authError: string | null;
  setTokens: (access: string, refresh: string) => void;
  setAuthError: (message: string | null) => void;
  logout: () => void;
}

const runtimeConfig = window.__APP_CONFIG__;

const initialAccessToken =
  runtimeConfig?.VITE_ACCESS_TOKEN ??
  runtimeConfig?.ACCESS_TOKEN ??
  runtimeConfig?.ACCESSTOKEN ??
  import.meta.env.VITE_ACCESS_TOKEN ??
  import.meta.env.ACCESS_TOKEN ??
  import.meta.env.ACCESSTOKEN ??
  "";

const initialRefreshToken =
  runtimeConfig?.VITE_REFRESH_TOKEN ??
  runtimeConfig?.REFRESH_TOKEN ??
  runtimeConfig?.REFRESHTOKEN ??
  import.meta.env.VITE_REFRESH_TOKEN ??
  import.meta.env.REFRESH_TOKEN ??
  import.meta.env.REFRESHTOKEN ??
  "";

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initialAccessToken,
  refreshToken: initialRefreshToken,
  authError: null,
  setTokens: (accessToken, refreshToken) =>
    set({ accessToken, refreshToken, authError: null }),
  setAuthError: (authError) => set({ authError }),
  logout: () => set({ accessToken: "", refreshToken: "" }),
}));
