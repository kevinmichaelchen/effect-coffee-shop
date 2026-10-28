import { Tokenizer } from "@huggingface/tokenizers";
import type { AudioTranscriberOptions } from "./transcriber";

const modelBytes = (options: AudioTranscriberOptions) => async (file: string) =>
  options.fetchBytes(`${options.modelBaseUrl.replace(/\/$/, "")}/${file}`, (loaded, total) =>
    options.onProgress?.({ file, loaded, total }),
  );
export const createSession = async (options: AudioTranscriberOptions, name: string) => {
  const { ort } = options;
  const bytes = modelBytes(options);
  const file = `${name}.onnx`;
  const shards =
    name === "decoder"
      ? ["", "_1", "_2", "_3"]
      : name === "decoder_fp16" || name === "decoder_q8"
        ? ["", "_1"]
        : [""];
  const graph = await bytes(`onnx/${file}`);
  const externalData = await Promise.all(
    shards.map(async (suffix) => ({
      path: `${file}_data${suffix}`,
      data: await bytes(`onnx/${file}_data${suffix}`),
    })),
  );
  return ort.InferenceSession.create(graph, {
    executionProviders: [...options.executionProviders],
    externalData,
  });
};

export const loadTokenizer = async (options: AudioTranscriberOptions) => {
  const bytes = modelBytes(options);
  // JSON parsing is confined to the tokenizer adapter; Tokenizer owns its config format.
  const json = async (file: string): Promise<object> => {
    const value: unknown = JSON.parse(new TextDecoder().decode(await bytes(file)));
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new Error(`Invalid tokenizer object: ${file}`);
    return value;
  };
  const tokenizer = new Tokenizer(
    await json("tokenizer.json"),
    await json("tokenizer_config.json"),
  );
  return tokenizer;
};
