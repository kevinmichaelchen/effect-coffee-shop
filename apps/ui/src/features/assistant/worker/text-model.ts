import {
  env,
  pipeline,
  type ProgressInfo,
  type TextGenerationPipeline,
} from "@huggingface/transformers";
import { Data, Effect, Schema } from "effect";
import type { WorkerRequest } from "#features/assistant/lib/protocol.ts";
import { fetchWithoutReferrer } from "#features/assistant/worker/fetch.ts";

env.fetch = fetchWithoutReferrer;

export const textModelId = "onnx-community/LFM3-1.7B-ONNX";

/** Model card defaults for tool use, made greedy so the same request gives the same call. */
const generation = {
  max_new_tokens: 256,
  do_sample: false,
  repetition_penalty: 1.05,
} as const;

export class TextModelError extends Data.TaggedError("TextModelError")<{
  readonly message: string;
}> {}

const failure = (cause: unknown) =>
  new TextModelError({ message: cause instanceof Error ? cause.message : String(cause) });

/** Downloads (or reads from the Cache API) and compiles LFM3-1.7B q4f16 on WebGPU. */
export const loadTextModel = (onProgress: (info: ProgressInfo) => void) =>
  Effect.tryPromise({
    try: () =>
      pipeline("text-generation", textModelId, {
        dtype: "q4f16",
        device: "webgpu",
        progress_callback: onProgress,
      }),
    catch: failure,
  });

type Generate = Extract<WorkerRequest, { readonly _tag: "Generate" }>;

const lastContent = Schema.decodeUnknownOption(
  Schema.Tuple([
    Schema.Struct({
      generated_text: Schema.Array(Schema.Struct({ content: Schema.String })),
    }),
  ]),
);

/** Runs one chat turn with the tools rendered by LFM3's chat template; returns the raw reply. */
export const generate = (model: TextGenerationPipeline, request: Generate) =>
  Effect.tryPromise({
    try: () =>
      model([...request.messages], {
        ...generation,
        tokenizer_encode_kwargs: { enable_thinking: false, tools: [...request.tools] },
      }),
    catch: failure,
  }).pipe(
    Effect.flatMap((output) =>
      Effect.fromOption(
        lastContent(output),
        () => new TextModelError({ message: "The model returned no text." }),
      ).pipe(Effect.map(([first]) => first.generated_text.at(-1)?.content ?? "")),
    ),
  );
