/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COFFEE_API_URL?: string;
  readonly VITE_COFFEE_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
