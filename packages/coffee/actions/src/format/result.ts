import * as Formatter from "effect/Formatter";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const decodeString = Schema.decodeUnknownOption(Schema.String);
const formatJsonResult = (value: unknown) =>
  Option.liftPredicate(Formatter.formatJson(value), (formatted) => formatted !== "undefined");

export const serializeToolResult = (result: unknown): string =>
  Option.getOrElse(decodeString(result), () =>
    Option.getOrElse(formatJsonResult(result), () => "null"),
  );
