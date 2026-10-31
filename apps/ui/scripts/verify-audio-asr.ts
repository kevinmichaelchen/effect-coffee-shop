/// <reference types="node" />

import * as ort from "onnxruntime-node";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { loadAudioTranscriber } from "../src/features/assistant/worker/audio/transcriber";

const modelBaseUrl = "https://huggingface.co/LiquidAI/LFM3-Audio-2B-ONNX/resolve/main";
const cache = join(homedir(), ".cache", "lfm3-audio");
const fetchBytes = async (url: string, onProgress: (loaded: number, total: number) => void) => {
  const file = join(cache, url.slice(modelBaseUrl.length + 1));
  const cached = await stat(file).catch(() => undefined);
  if (cached) {
    onProgress(cached.size, cached.size);
    return new Uint8Array(await readFile(file));
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download ${response.status}: ${url}`);
  const total = Number(response.headers.get("content-length") ?? 0);
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for await (const chunk of response.body) {
    chunks.push(chunk);
    loaded += chunk.length;
    onProgress(loaded, total);
  }
  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.partial`, data);
  await rename(`${file}.partial`, file);
  return data;
};

/** WAV boundary: only mono, little endian PCM16 at 16 kHz is accepted. */
const readWav = (bytes: Uint8Array): Float32Array => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => new TextDecoder().decode(bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Expected RIFF/WAVE");
  let validFormat = false;
  let samples: Float32Array | undefined;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error("Truncated WAV chunk");
    if (tag(offset) === "fmt ") {
      validFormat =
        size >= 16 &&
        view.getUint16(start, true) === 1 &&
        view.getUint16(start + 2, true) === 1 &&
        view.getUint32(start + 4, true) === 16000 &&
        view.getUint16(start + 14, true) === 16;
    }
    if (tag(offset) === "data")
      samples = Float32Array.from(
        { length: Math.floor(size / 2) },
        (_, i) => view.getInt16(start + i * 2, true) / 32768,
      );
    offset = start + size + (size % 2);
  }
  if (!validFormat || !samples) throw new Error("Expected mono PCM16 WAV at 16 kHz");
  return samples;
};

const pcm = readWav(new Uint8Array(await readFile(process.argv[2] ?? "/tmp/order.wav")));
const start = performance.now();
const completed = new Set<string>();
const transcriber = await loadAudioTranscriber({
  ort,
  modelBaseUrl,
  fetchBytes,
  executionProviders: ["cpu"],
  decoder: "q4",
  onProgress: ({ file, loaded, total }) => {
    if (loaded === total && !completed.has(file)) {
      completed.add(file);
      console.log(`Loaded ${file}: ${loaded} bytes`);
    }
  },
});
console.log(`CPU load: ${((performance.now() - start) / 1000).toFixed(2)}s`);
const transcribeStart = performance.now();
const transcript = await transcriber.transcribe(pcm);
console.log(`Transcript: ${transcript}`);
console.log(`CPU transcription: ${((performance.now() - transcribeStart) / 1000).toFixed(2)}s`);
await transcriber.dispose();
