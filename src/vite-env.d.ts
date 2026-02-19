/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACCESS_TOKEN?: string;
  readonly VITE_REFRESH_TOKEN?: string;
  readonly ACCESS_TOKEN?: string;
  readonly REFRESH_TOKEN?: string;
  readonly ACCESSTOKEN?: string;
  readonly REFRESHTOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __APP_CONFIG__?: {
    VITE_ACCESS_TOKEN?: string;
    VITE_REFRESH_TOKEN?: string;
    ACCESS_TOKEN?: string;
    REFRESH_TOKEN?: string;
    ACCESSTOKEN?: string;
    REFRESHTOKEN?: string;
  };
}
