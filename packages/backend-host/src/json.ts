import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const encodeJsonString = Schema.encodeUnknownSync(Schema.UnknownFromJsonString);
const encodeJsonStringOption = Schema.encodeUnknownOption(Schema.UnknownFromJsonString);

export const jsonString = (value: unknown): string => encodeJsonString(value);

export const jsonStringOr = (value: unknown, fallback: string): string =>
  Option.getOrElse(encodeJsonStringOption(value), () => fallback);
