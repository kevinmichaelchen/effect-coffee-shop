/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COFFEE_API_URL?: string;
  readonly VITE_COFFEE_PROXY_TARGET?: string;
  /** The Worker's OTLP relay; tracing is off when unset. */
  readonly VITE_COFFEE_TRACE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
