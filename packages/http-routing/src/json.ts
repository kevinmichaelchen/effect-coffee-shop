import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const encodeJsonString = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
const encodeJsonStringOption = Schema.encodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

export const jsonString = encodeJsonString;

// oxlint-disable-next-line effect/no-unknown-parameters -- Serialization boundary accepts arbitrary values and validates/formats them before transport.
export const jsonStringOr = (value: unknown, fallback: string): string =>
  Option.getOrElse(encodeJsonStringOption(value), () => fallback);
