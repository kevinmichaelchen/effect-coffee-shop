import type * as OnnxRuntime from "onnxruntime-web";
import type { BrowserChatMessage } from "#lib/lfm-browser";
import { toFloat32Array } from "#lib/ortTensor";
const TEMPERATURE = 0.1;
const TOP_K = 50;
const REPETITION_PENALTY = 1.05;
const HIDDEN_SIZE = 1024;
const NUM_KV_HEADS = 8;
const HEAD_DIM = 64;
type RuntimeModule = typeof import("onnxruntime-web");
type TransformersModule = typeof import("@huggingface/transformers");
type TokenizerInstance = Awaited<ReturnType<TransformersModule["AutoTokenizer"]["from_pretrained"]>>;
type CacheMap = Record<string, OnnxRuntime.Tensor>;
type ModelOutputs = Record<string, OnnxRuntime.Tensor>;
interface GenerationState {
  cache: CacheMap;
  currentIds: readonly number[];
  generatedTokens: number[];
  sequenceLength: number;
}

export async function runGeneration(input: {
  readonly maxNewTokens: number;
  readonly messages: readonly BrowserChatMessage[];
  readonly onToken?: (text: string) => void;
  readonly ort: RuntimeModule;
  readonly session: OnnxRuntime.InferenceSession;
  readonly tokenizer: TokenizerInstance;
}): Promise<string> {
  const { maxNewTokens, messages, onToken, ort, session, tokenizer } = input;
  const state = createGenerationState(ort, session, tokenizer, messages);

  for (let step = 0; step < maxNewTokens; step++) {
    const nextToken = await runGenerationStep({
      ort,
      session,
      state,
      step,
      tokenizer,
      ...(onToken === undefined ? {} : { onToken }),
    });
    if (nextToken === null) {
      break;
    }
  }

  return decodeTokens(tokenizer, state.generatedTokens);
}

function createGenerationState(ort: RuntimeModule, session: OnnxRuntime.InferenceSession, tokenizer: TokenizerInstance, messages: readonly BrowserChatMessage[]): GenerationState {
  const promptIds = buildPromptIds(tokenizer, messages);
  return {
    cache: createCache(ort, session),
    currentIds: promptIds,
    generatedTokens: [],
    sequenceLength: promptIds.length,
  };
}

async function runGenerationStep(input: {
  readonly onToken?: (text: string) => void;
  readonly ort: RuntimeModule;
  readonly session: OnnxRuntime.InferenceSession;
  readonly state: GenerationState;
  readonly step: number;
  readonly tokenizer: TokenizerInstance;
}): Promise<number | null> {
  const { onToken, ort, session, state, step, tokenizer } = input;
  const outputs = await session.run(
    createFeed({
      cache: state.cache,
      ids: state.currentIds,
      isFirstStep: step === 0,
      ort,
      sequenceLength: state.sequenceLength,
      session,
    }),
  );
  const nextToken = sampleToken(readLastLogits(outputs), state.generatedTokens);
  state.generatedTokens.push(nextToken);
  onToken?.(decodeTokens(tokenizer, state.generatedTokens));
  if (nextToken === tokenizer.eos_token_id) {
    return null;
  }

  advanceGenerationState(state, outputs, nextToken);
  return nextToken;
}

function advanceGenerationState(
  state: GenerationState,
  outputs: ModelOutputs,
  nextToken: number,
): void {
  updateCache(state.cache, outputs);
  state.currentIds = [nextToken];
  state.sequenceLength += 1;
}

function buildPromptIds(
  tokenizer: TokenizerInstance,
  messages: readonly BrowserChatMessage[],
): readonly number[] {
  const prompt = tokenizer.apply_chat_template([...messages], {
    add_generation_prompt: true,
    tokenize: false,
  });

  if (typeof prompt !== "string") {
    throw new Error("Expected the chat template to return a prompt string.");
  }

  return Array.from(tokenizer.encode(prompt));
}

function createCache(ort: RuntimeModule, session: OnnxRuntime.InferenceSession): CacheMap {
  const cache: CacheMap = {};

  for (const name of session.inputNames) {
    if (name.startsWith("past_conv")) {
      cache[name] = new ort.Tensor("float32", new Float32Array(HIDDEN_SIZE * 3), [1, HIDDEN_SIZE, 3]);
      continue;
    }

    if (name.startsWith("past_key_values")) {
      cache[name] = new ort.Tensor("float32", new Float32Array(0), [1, NUM_KV_HEADS, 0, HEAD_DIM]);
    }
  }

  return cache;
}

function createFeed(input: {
  readonly cache: CacheMap;
  readonly ids: readonly number[];
  readonly isFirstStep: boolean;
  readonly ort: RuntimeModule;
  readonly sequenceLength: number;
  readonly session: OnnxRuntime.InferenceSession;
}): Record<string, OnnxRuntime.Tensor> {
  const { cache, ids, isFirstStep, ort, sequenceLength, session } = input;
  const feed: Record<string, OnnxRuntime.Tensor> = {
    ...cache,
    attention_mask: createAttentionMask(ort, sequenceLength),
    input_ids: createInt64Tensor(ort, ids, [1, ids.length]),
  };

  if (session.inputNames.includes("position_ids")) {
    const positionIds = isFirstStep
      ? Array.from({ length: ids.length }, (_, index) => index)
      : [sequenceLength - 1];

    feed.position_ids = createInt64Tensor(ort, positionIds, [1, positionIds.length]);
  }

  if (session.inputNames.includes("num_logits_to_keep")) {
    feed.num_logits_to_keep = createInt64Tensor(ort, [1], []);
  }

  return feed;
}

function createAttentionMask(ort: RuntimeModule, length: number): OnnxRuntime.Tensor {
  return new ort.Tensor("int64", new BigInt64Array(length).fill(1n), [1, length]);
}

function createInt64Tensor(
  ort: RuntimeModule,
  values: readonly number[],
  dims: readonly number[],
): OnnxRuntime.Tensor {
  return new ort.Tensor("int64", BigInt64Array.from(values, (value) => BigInt(value)), dims);
}

function updateCache(cache: CacheMap, outputs: ModelOutputs): void {
  for (const [name, tensor] of Object.entries(outputs)) {
    if (name.startsWith("present_conv")) {
      cache[name.replace("present_conv", "past_conv")] = tensor;
      continue;
    }

    if (name.startsWith("present.")) {
      cache[name.replace("present.", "past_key_values.")] = tensor;
    }
  }
}

function readLastLogits(outputs: ModelOutputs): Float32Array {
  const logits = outputs.logits;
  if (logits === undefined) {
    throw new Error("Model output is missing logits.");
  }

  const vocabSize = logits.dims[2];
  const sequenceSize = logits.dims[1];
  if (vocabSize === undefined || sequenceSize === undefined) {
    throw new Error("Unexpected logits shape from ONNX session.");
  }

  const lastIndex = (sequenceSize - 1) * vocabSize;
  const view = logits.data.slice(lastIndex, lastIndex + vocabSize);
  return toFloat32Array(view);
}

function sampleToken(logits: Float32Array, generatedTokens: readonly number[]): number {
  const adjusted = applyRepetitionPenalty(logits, generatedTokens);
  const ranked = Array.from(adjusted, (value, index) => [value / TEMPERATURE, index] as const);
  ranked.sort((left, right) => right[0] - left[0]);
  const topK = ranked.slice(0, TOP_K);
  const maxLogit = topK[0]?.[0] ?? 0;
  const weights = topK.map(([value]) => Math.exp(value - maxLogit));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return pickWeightedToken(topK, total, weights);
}

function pickWeightedToken(
  topK: ReadonlyArray<readonly [number, number]>,
  total: number,
  weights: readonly number[],
): number {
  let cursor = Math.random();

  for (const [index, [, tokenId]] of topK.entries()) {
    const weight = weights[index];
    if (weight === undefined) {
      continue;
    }

    cursor -= weight / total;
    if (cursor <= 0) {
      return tokenId;
    }
  }

  return topK.at(-1)?.[1] ?? 0;
}

function applyRepetitionPenalty(logits: Float32Array, generatedTokens: readonly number[]): Float32Array {
  const adjusted = Float32Array.from(logits);

  for (const tokenId of new Set(generatedTokens)) {
    const current = adjusted[tokenId];
    if (current === undefined) {
      continue;
    }

    adjusted[tokenId] = current > 0 ? current / REPETITION_PENALTY : current * REPETITION_PENALTY;
  }

  return adjusted;
}

function decodeTokens(tokenizer: TokenizerInstance, generatedTokens: readonly number[]): string {
  return tokenizer.decode([...generatedTokens], { skip_special_tokens: false });
}
