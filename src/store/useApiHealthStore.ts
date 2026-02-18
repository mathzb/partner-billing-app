import { create } from "zustand";

export type ApiHealthStatus = "unknown" | "connected" | "disconnected";

const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 499;
const SERVER_ERROR_MIN = 500;
const SERVER_ERROR_MAX = 599;

export const isClientErrorStatus = (status?: number | null) =>
  typeof status === "number" &&
  status >= CLIENT_ERROR_MIN &&
  status <= CLIENT_ERROR_MAX;

export const isServerErrorStatus = (status?: number | null) =>
  typeof status === "number" &&
  status >= SERVER_ERROR_MIN &&
  status <= SERVER_ERROR_MAX;

type ApiHealthState = {
  status: ApiHealthStatus;
  lastUpdated: number | null;
  setStatus: (status: ApiHealthStatus) => void;
};

export const useApiHealthStore = create<ApiHealthState>((set) => ({
  status: "unknown",
  lastUpdated: null,
  setStatus: (status) =>
    set((current) =>
      current.status === status ? current : { status, lastUpdated: Date.now() },
    ),
}));

export const markApiConnected = () => {
  const store = useApiHealthStore.getState();
  if (store.status !== "connected") {
    store.setStatus("connected");
  }
};

export const markApiDisconnected = () => {
  const store = useApiHealthStore.getState();
  if (store.status !== "disconnected") {
    store.setStatus("disconnected");
  }
};
