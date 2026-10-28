import type { Tokenizer } from "@huggingface/tokenizers";
import type { InferenceSession, Tensor } from "onnxruntime-web";
import { extractAudioFeatures } from "./log-mel";
import { createDecoder } from "./decoder";
import { createSession, loadTokenizer } from "./model-assets";
import { disposeTensors, required } from "./ort";

/** Structural injection accepts both onnxruntime-web/webgpu and onnxruntime-node. */
export interface AudioOrt {
  readonly Tensor: typeof Tensor;
  readonly InferenceSession: Pick<typeof InferenceSession, "create">;
}
export interface AudioTranscriber {
  readonly transcribe: (pcm16k: Float32Array) => Promise<string>;
  readonly dispose: () => Promise<void>;
}
export interface AudioTranscriberOptions {
  readonly ort: AudioOrt;
  readonly modelBaseUrl: string;
  readonly fetchBytes: (
    url: string,
    onProgress: (loaded: number, total: number) => void,
  ) => Promise<Uint8Array>;
  readonly executionProviders: ReadonlyArray<string>;
  readonly onProgress?: (progress: { file: string; loaded: number; total: number }) => void;
  /** Defaults to q4f16 on WebGPU, q4 elsewhere. All variants use the float32 encoder. */
  readonly decoder?: "q4" | "q8" | "q4f16" | "q8f16" | "fp16" | "fp32";
}

const promptTokens = (tokenizer: Tokenizer, count: number) =>
  tokenizer.encode(
    `<|startoftext|><|im_start|>system\nPerform ASR in English.<|im_end|>\n<|im_start|>user\n${"<|audio|>".repeat(count)}<|im_end|>\n<|im_start|>assistant\n`,
    { add_special_tokens: false },
  ).ids;
const generate = async (
  step: (ids: number[]) => Promise<number>,
  promptIds: number[],
  stops: Set<number>,
) => {
  let token = 0;
  let offset = 0;
  while (offset < promptIds.length) {
    token = await step(promptIds.slice(offset, offset + 1024));
    offset += 1024;
  }
  const generated: number[] = [];
  while (generated.length < 256 && !stops.has(token)) {
    generated.push(token);
    if (generated.length < 256) token = await step([token]);
  }
  return generated;
};
const makeInference = (
  options: AudioTranscriberOptions,
  encoder: InferenceSession,
  decoder: InferenceSession,
  tokenizer: Tokenizer,
) => {
  const audioId = required(tokenizer.token_to_id("<|audio|>"), "audio token");
  const stops = new Set(
    ["<|im_end|>", "<|endoftext|>"].map((token) => required(tokenizer.token_to_id(token), token)),
  );
  return async (pcm: Float32Array) => {
    const mel = extractAudioFeatures(pcm);
    const input = new options.ort.Tensor("float32", mel.inputFeatures, [1, 128, mel.numFrames]);
    const output = await encoder.run({ input_features: input }).finally(() => input.dispose());
    const decode = async () => {
      const audio = required(output.audio_features, "audio_features");
      if (audio.type !== "float32" || audio.dims[0] !== mel.numAudioTokens)
        throw new Error("Unexpected encoder output");
      const state = createDecoder(options.ort, decoder, audio, audioId);
      const tokens = await generate(
        state.step,
        promptTokens(tokenizer, mel.numAudioTokens),
        stops,
      ).finally(state.dispose);
      return tokenizer.decode(tokens, { skip_special_tokens: true }).trim();
    };
    return decode().finally(() => disposeTensors(output));
  };
};
const lifecycle = (
  infer: (pcm: Float32Array) => Promise<string>,
  sessions: InferenceSession[],
): AudioTranscriber => {
  let disposed = false;
  let active: Promise<unknown> = Promise.resolve();
  return {
    transcribe: async (pcm) => {
      if (disposed) throw new Error("Audio transcriber is disposed");
      const result = active.then(async () => infer(pcm));
      active = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      await active;
      await Promise.all(sessions.map(async (session) => session.release()));
    },
  };
};
export const loadAudioTranscriber = async (
  options: AudioTranscriberOptions,
): Promise<AudioTranscriber> => {
  const tokenizer = await loadTokenizer(options);
  const precision =
    options.decoder ?? (options.executionProviders.includes("webgpu") ? "q4f16" : "q4");
  const encoder = await createSession(options, "audio_encoder");
  const decoder = await createSession(
    options,
    precision === "fp32" ? "decoder" : `decoder_${precision}`,
  ).catch(async (error: unknown) => {
    await encoder.release();
    throw error;
  });
  return lifecycle(makeInference(options, encoder, decoder, tokenizer), [encoder, decoder]);
};
