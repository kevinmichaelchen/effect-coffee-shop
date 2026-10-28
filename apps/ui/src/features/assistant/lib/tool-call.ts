import { Option, Schema } from "effect";

/** One call in LFM3's XML tool-call format, with arguments still untyped. */
export interface RawToolCall {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

/** The model's text with its tool calls split out. */
export interface ParsedReply {
  readonly text: string;
  readonly calls: readonly RawToolCall[];
}

const callPattern = /<tool_call>\s*<function=([^>\n]+)>([\s\S]*?)<\/function>\s*<\/tool_call>/g;
const parameterPattern = /<parameter=([^>\n]+)>\n?([\s\S]*?)\n?<\/parameter>/g;

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

/** Values other than strings arrive as JSON; anything that is not JSON is a plain string. */
const parameterValue = (raw: string): unknown => {
  const trimmed = raw.trim();
  return Option.getOrElse(decodeJson(trimmed), () => trimmed);
};

const parseCall = ([, name = "", body = ""]: RegExpExecArray): RawToolCall => ({
  name: name.trim(),
  arguments: Object.fromEntries(
    Array.from(body.matchAll(parameterPattern), ([, key = "", value = ""]) => [
      key.trim(),
      parameterValue(value),
    ]),
  ),
});

/** A leaked reasoning trace (`…</think>`) is not part of the answer. */
const withoutThinking = (output: string): string =>
  output.replace(/^[\s\S]*<\/think>/, "").replace(/<\/?think>/g, "");

/**
 * Splits LFM3 output into prose and tool calls. LFM3 and LFM3-Audio share this
 * format: `<tool_call><function=name><parameter=key>value</parameter></function></tool_call>`.
 */
export const parseReply = (output: string): ParsedReply => ({
  text: withoutThinking(output.replace(callPattern, "")).trim(),
  calls: Array.from(output.matchAll(callPattern), parseCall),
});
