import * as ort from "onnxruntime-web/webgpu";
import { Data, Effect } from "effect";
import { aggregateProgress } from "#features/assistant/worker/progress.ts";
import {
  type AudioTranscriber,
  loadAudioTranscriber,
} from "#features/assistant/worker/audio/transcriber.ts";

export class VoiceModelError extends Data.TaggedError("VoiceModelError")<{
  readonly message: string;
}> {}

export type VoiceModel = AudioTranscriber;

// ORT warns about every CPU-placed shape op; only errors are worth the console.
ort.env.logLevel = "error";

const modelBaseUrl = "https://huggingface.co/LiquidAI/LFM3-Audio-2B-ONNX/resolve/main";
const cacheName = "lfm3-audio-2b-onnx";

const failure = (cause: unknown) =>
  new VoiceModelError({ message: cause instanceof Error ? cause.message : String(cause) });

/**
 * Reads a body into one buffer. When the size is known it writes in place, so a
 * 1.4 GB file is not held twice; if the body outgrows it, it falls back to chunks.
 */
const readAll = async (
  response: Response,
  onProgress: (loaded: number, total: number) => void,
): Promise<Uint8Array<ArrayBuffer>> => {
  const total = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body?.getReader();
  if (reader === undefined) return new Uint8Array(await response.arrayBuffer());
  const sized = new Uint8Array(total);
  const spilled: Uint8Array[] = [];
  const pump = async (loaded: number): Promise<number> => {
    const { done, value } = await reader.read();
    if (done) return loaded;
    if (spilled.length === 0 && loaded + value.byteLength <= total) sized.set(value, loaded);
    else spilled.push(...(spilled.length === 0 ? [sized.subarray(0, loaded)] : []), value);
    onProgress(loaded + value.byteLength, Math.max(total, loaded + value.byteLength));
    return pump(loaded + value.byteLength);
  };
  const size = await pump(0);
  if (spilled.length === 0) return size === total ? sized : sized.slice(0, size);
  const bytes = new Uint8Array(size);
  spilled.reduce((offset, chunk) => {
    bytes.set(chunk, offset);
    return offset + chunk.byteLength;
  }, 0);
  return bytes;
};

/** Hugging Face files, kept in the Cache API so the ~1.9 GB download happens once. */
const fetchBytes = async (url: string, onProgress: (loaded: number, total: number) => void) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(url);
  if (cached !== undefined) return readAll(cached, onProgress);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Could not download ${url.split("/").at(-1)} (${response.status}).`);
  const bytes = await readAll(response, onProgress);
  await cache.put(url, new Response(bytes, { headers: response.headers }));
  return bytes;
};

/** Loads LFM3-Audio-2B (float32 encoder, q4f16 decoder) on WebGPU for speech-to-text. */
export const loadVoiceModel = (onProgress: (loaded: number, total: number) => void) => {
  const progress = aggregateProgress(onProgress);
  return Effect.tryPromise({
    try: () =>
      loadAudioTranscriber({
        ort,
        modelBaseUrl,
        fetchBytes,
        executionProviders: ["webgpu"],
        onProgress: ({ file, loaded, total }) => progress(file, loaded, total),
      }),
    catch: failure,
  });
};

export const transcribe = (model: VoiceModel, samples: Float32Array) =>
  Effect.tryPromise({ try: () => model.transcribe(samples), catch: failure });
