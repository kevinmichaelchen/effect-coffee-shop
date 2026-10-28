import * as ort from "onnxruntime-web/webgpu";

/**
 * ONNX Runtime's wasm (about 27 MB) is over Cloudflare's 25 MiB per-asset
 * limit, so the build resolves the extern-wasm entry and the worker fetches
 * the matching wasm from jsDelivr, which is what Transformers.js does too.
 * Import this before any model so both share the setting.
 */
const cdn = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
ort.env.wasm.wasmPaths = {
  mjs: `${cdn}ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${cdn}ort-wasm-simd-threaded.asyncify.wasm`,
};
// ORT warns about every CPU-placed shape op; only errors are worth the console.
ort.env.logLevel = "error";
