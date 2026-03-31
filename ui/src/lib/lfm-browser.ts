import type { ProgressInfo } from "@huggingface/transformers";
import type * as OnnxRuntime from "onnxruntime-web";
import { runGeneration } from "#lib/lfm-generation";
import { MODEL_DATA_PATH, MODEL_ID, MODEL_PATH } from "#lib/lfm-model";

type RuntimeModule = typeof import("onnxruntime-web");
type TransformersModule = typeof import("@huggingface/transformers");
type TokenizerInstance = Awaited<ReturnType<TransformersModule["AutoTokenizer"]["from_pretrained"]>>;

export interface BrowserChatMessage {
  readonly content: string;
  readonly role: "assistant" | "system" | "tool" | "user";
}

export interface ModelProgressUpdate {
  readonly label: string;
  readonly progress: number;
}

interface BrowserRuntime {
  readonly AutoTokenizer: TransformersModule["AutoTokenizer"];
  readonly ort: RuntimeModule;
}

export class LfmBrowserModel {
  private loadPromise: Promise<void> | null = null;
  private runtime: BrowserRuntime | null = null;
  private session: OnnxRuntime.InferenceSession | null = null;
  private tokenizer: TokenizerInstance | null = null;

  isLoaded(): boolean {
    return this.tokenizer !== null && this.session !== null;
  }

  async load(onProgress?: (update: ModelProgressUpdate) => void): Promise<void> {
    if (this.isLoaded()) {
      return;
    }

    if (this.loadPromise !== null) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadInternal(onProgress).finally(() => {
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  async generate(
    messages: readonly BrowserChatMessage[],
    maxNewTokens: number,
    onToken?: (text: string) => void,
  ): Promise<string> {
    await this.load();
    const runtime = this.requireRuntime();
    const session = this.requireSession();
    const tokenizer = this.requireTokenizer();
    return runGeneration({
      maxNewTokens,
      messages,
      ...(onToken === undefined ? {} : { onToken }),
      ort: runtime.ort,
      session,
      tokenizer,
    });
  }

  private async loadInternal(onProgress?: (update: ModelProgressUpdate) => void): Promise<void> {
    await ensureWebGpu();
    onProgress?.({ label: "Loading Transformers.js runtime", progress: 8 });
    const runtime = await loadRuntime();
    runtime.ort.env.wasm.numThreads = 1;
    const tokenizer = await runtime.AutoTokenizer.from_pretrained(MODEL_ID, {
      progress_callback: (info) => onProgress?.(mapTokenizerProgress(info)),
    });
    onProgress?.({ label: "Opening WebGPU session", progress: 84 });
    const session = await runtime.ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["webgpu"],
      externalData: [{ data: MODEL_DATA_PATH, path: "model_q4.onnx_data" }],
    });
    this.runtime = runtime;
    this.session = session;
    this.tokenizer = tokenizer;
    onProgress?.({ label: "LFM2.5-350M ready in browser", progress: 100 });
  }

  private requireRuntime(): BrowserRuntime {
    if (this.runtime === null) {
      throw new Error("Browser runtime not loaded");
    }

    return this.runtime;
  }

  private requireSession(): OnnxRuntime.InferenceSession {
    if (this.session === null) {
      throw new Error("ONNX session not loaded");
    }

    return this.session;
  }

  private requireTokenizer(): TokenizerInstance {
    if (this.tokenizer === null) {
      throw new Error("Tokenizer not loaded");
    }

    return this.tokenizer;
  }
}

async function loadRuntime(): Promise<BrowserRuntime> {
  const [transformers, ort] = await Promise.all([
    import("@huggingface/transformers"),
    import("onnxruntime-web/webgpu"),
  ]);

  return {
    AutoTokenizer: transformers.AutoTokenizer,
    ort,
  };
}

async function ensureWebGpu(): Promise<void> {
  if (!("gpu" in navigator)) {
    throw new Error("WebGPU is unavailable in this browser.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (adapter === null) {
    throw new Error("WebGPU adapter not found. Check your browser GPU settings.");
  }
}

function mapTokenizerProgress(info: ProgressInfo): ModelProgressUpdate {
  if (info.status === "progress_total") {
    return {
      label: "Downloading tokenizer assets",
      progress: 12 + Math.round(info.progress * 0.58),
    };
  }

  if (info.status === "ready") {
    return { label: "Tokenizer loaded", progress: 76 };
  }

  return { label: "Loading tokenizer", progress: 16 };
}
