import type { InferenceSession, Tensor } from "onnxruntime-web";
import type { AudioOrt } from "./transcriber";
import { required, disposeTensors } from "./ort";

const cacheDimension = (dim: number | string): number => {
  if (typeof dim === "number") return dim;
  if (dim === "batch_size") return 1;
  if (dim === "past_sequence_length") return 0;
  throw new Error(`Unexpected cache dimension ${dim}`);
};
const emptyCache = (ort: AudioOrt, meta: InferenceSession.ValueMetadata): Tensor => {
  if (!meta.isTensor || (meta.type !== "float16" && meta.type !== "float32"))
    throw new Error(`Unsupported cache ${meta.name}`);
  const dims = meta.shape.map(cacheDimension);
  const size = dims.reduce((a, b) => a * b, 1);
  return meta.type === "float16"
    ? new ort.Tensor("float16", new Uint16Array(size), dims)
    : new ort.Tensor("float32", new Float32Array(size), dims);
};
const greedy = async (logits: Tensor): Promise<number> => {
  const data = await logits.getData();
  let best = -Infinity;
  let token = 0;
  for (const [index, value] of data.entries()) {
    if (Number(value) > best) {
      best = Number(value);
      token = index;
    }
  }
  return token;
};
const stepInputs = (ort: AudioOrt, ids: number[], position: number, audio: Tensor) => {
  const int64 = (values: number[], dims: number[]) =>
    new ort.Tensor("int64", BigInt64Array.from(values, BigInt), dims);
  return {
    input_ids: int64(ids, [1, ids.length]),
    attention_mask: new ort.Tensor("int64", new BigInt64Array(position + ids.length).fill(1n), [
      1,
      position + ids.length,
    ]),
    position_ids: int64(
      ids.map((_, i) => position + i),
      [1, ids.length],
    ),
    logits_to_keep: int64([1], [1]),
    audio_features: audio,
    audio_out_codes: int64([], [0, 12]),
  };
};
const audioChunk = (ort: AudioOrt, audio: Tensor, offset: number, count: number) => {
  const width = required(audio.dims[1], "embedding width");
  const embeddings = new Float32Array(count * width);
  for (const [index, value] of audio.data.slice(offset * width, (offset + count) * width).entries())
    embeddings[index] = Number(value);
  return new ort.Tensor("float32", embeddings, [count, width]);
};
export const createDecoder = (
  ort: AudioOrt,
  session: InferenceSession,
  audio: Tensor,
  audioId: number,
) => {
  const metadata = session.inputMetadata.filter((value) => value.name.startsWith("past"));
  let caches = Object.fromEntries(metadata.map((meta) => [meta.name, emptyCache(ort, meta)]));
  let position = 0;
  let audioOffset = 0;
  return {
    step: async (ids: number[]) => {
      const count = ids.filter((id) => id === audioId).length;
      const inputs = stepInputs(ort, ids, position, audioChunk(ort, audio, audioOffset, count));
      const output = await session
        .run({ ...inputs, ...caches })
        .finally(() => disposeTensors(inputs));
      disposeTensors(caches);
      caches = Object.fromEntries(
        metadata.map((meta) => [
          meta.name,
          required(
            output[
              meta.name
                .replace("past_key_values.", "present.")
                .replace("past_conv.", "present_conv.")
            ],
            meta.name,
          ),
        ]),
      );
      position += ids.length;
      audioOffset += count;
      return greedy(required(output.logits, "logits")).finally(() => {
        output.logits?.dispose();
        output.hidden_states?.dispose();
      });
    },
    dispose: () => disposeTensors(caches),
  };
};
