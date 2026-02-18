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
        // Call the specific Cloud Factory refresh endpoint
        const { data } = await axios.get(
          `https://portal.api.cloudfactory.dk/Authenticate/ExchangeRefreshToken/${refreshToken}`,
        );

        // Update the store with new tokens
        useAuthStore
          .getState()
          .setTokens(data.access_token, data.refresh_token);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        handleConnectivityError(refreshError);
        // If refresh fails, log the user out
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }
    handleConnectivityError(error);
    return Promise.reject(error);
  },
);
