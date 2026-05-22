import * as Formatter from "effect/Formatter";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const decodeEmptyRecord = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Never));
const decodeString = Schema.decodeUnknownOption(Schema.String);
const formatJsonDetail = (value: unknown) =>
  Option.liftPredicate(
    Formatter.formatJson(value, { space: 2 }),
    (formatted) => formatted !== "undefined",
  );

export const formatToolPayload = (payload: unknown): string =>
  Option.match(decodeEmptyRecord(payload), {
    onNone: () =>
      Option.match(decodeString(payload), {
        onNone: () => Option.getOrElse(formatJsonDetail(payload), () => "No structured detail."),
        onSome: (text) => text,
      }),
    onSome: () => "No arguments.",
  });
