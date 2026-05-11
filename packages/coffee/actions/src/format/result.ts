import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const decodeString = Schema.decodeUnknownOption(Schema.String);

export const serializeToolResult = (result: unknown): string =>
  Option.getOrElse(decodeString(result), () => JSON.stringify(result) ?? "null");
