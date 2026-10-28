import { foldkit } from "@foldkit/vite-plugin";
import { defaultClientConditions, defineConfig, mergeConfig } from "vite";
import { sharedViteConfig } from "./vite.shared.ts";

export default defineConfig(
  mergeConfig(sharedViteConfig, {
    plugins: [foldkit()],
    // ONNX Runtime's extern-wasm entry leaves its 27 MB wasm out of the build
    // (Cloudflare caps assets at 25 MiB); the worker loads it from a CDN instead.
    resolve: { conditions: ["onnxruntime-web-use-extern-wasm", ...defaultClientConditions] },
    // The assistant worker is an entry too, so its heavy deps are optimized at
    // startup instead of on first use (which reloads the page mid-download).
    // ONNX Runtime stays unbundled so it can find its wasm files.
    optimizeDeps: {
      entries: ["src/entry.ts", "src/features/assistant/worker/assistant.worker.ts"],
      exclude: ["onnxruntime-web"],
    },
    // Transformers.js loads backends with dynamic imports, which need ES workers.
    worker: { format: "es" },
  }),
);
