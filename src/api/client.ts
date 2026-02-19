// src/api/client.ts
import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/useAuthStore";
import {
  markApiConnected,
  markApiDisconnected,
  isClientErrorStatus,
  isServerErrorStatus,
} from "../store/useApiHealthStore";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL: "https://portal.api.cloudfactory.dk/billing",
});

// 1. Request Interceptor: Attach the current Access Token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2. Response Interceptor: Handle 401 Unauthorized errors
const shouldMarkDisconnected = (error: AxiosError | undefined) => {
  if (!error) return false;
  if (!error.response) return true;
  const status = error.response.status;
  if (isServerErrorStatus(status)) return true;
  if (isClientErrorStatus(status)) return true;
  return false;
};

const handleConnectivityError = (error: unknown) => {
  const axiosError = error as AxiosError | undefined;
  if (shouldMarkDisconnected(axiosError)) {
    markApiDisconnected();
  }
};

apiClient.interceptors.response.use(
  (response) => {
    markApiConnected();
    useAuthStore.getState().setAuthError(null);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const refreshToken = useAuthStore.getState().refreshToken;

    if (!originalRequest) {
      handleConnectivityError(error);
      return Promise.reject(error);
    }

    // If the error is 401 and we haven't retried yet
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      refreshToken
    ) {
      originalRequest._retry = true;

      try {
        const encodedRefreshToken = encodeURIComponent(refreshToken);
        // Call the specific Cloud Factory refresh endpoint
        const { data } = await axios.get(
          `https://portal.api.cloudfactory.dk/Authenticate/ExchangeRefreshToken/${encodedRefreshToken}`,
        );

        const refreshedAccessToken =
          data?.access_token ?? data?.accessToken ?? data?.token;
        const refreshedRefreshToken =
          data?.refresh_token ?? data?.refreshToken ?? refreshToken;

        if (!refreshedAccessToken) {
          throw new Error("Refresh response missing access token");
        }

        // Update the store with new tokens
        useAuthStore
          .getState()
          .setTokens(refreshedAccessToken, refreshedRefreshToken);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${refreshedAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        handleConnectivityError(refreshError);
        // If refresh fails, log the user out
        useAuthStore.getState().logout();
        useAuthStore
          .getState()
          .setAuthError(
            "Din session er udløbet eller ugyldig. Opdater ACCESS/REFRESH token og prøv igen.",
          );
        return Promise.reject(refreshError);
      }
    }
    handleConnectivityError(error);
    return Promise.reject(error);
  },
);
