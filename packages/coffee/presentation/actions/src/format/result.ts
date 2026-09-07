import * as Formatter from "effect/Formatter";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const decodeString = Schema.decodeUnknownOption(Schema.String);
// oxlint-disable-next-line effect/no-unknown-parameters -- Serialization boundary accepts arbitrary values and validates/formats them before transport.
const formatJsonResult = (value: unknown) =>
  Option.liftPredicate(Formatter.formatJson(value), (formatted) => formatted !== "undefined");

// oxlint-disable-next-line effect/no-unknown-parameters -- Serialization boundary accepts arbitrary values and validates/formats them before transport.
export const serializeToolResult = (result: unknown): string =>
  Option.getOrElse(decodeString(result), () =>
    Option.getOrElse(formatJsonResult(result), () => "null"),
  );
