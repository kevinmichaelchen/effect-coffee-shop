import * as Formatter from "effect/Formatter";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const decodeEmptyRecord = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Never));
const decodeString = Schema.decodeUnknownOption(Schema.String);
// oxlint-disable-next-line effect/no-unknown-parameters -- Serialization boundary accepts arbitrary values and validates/formats them before transport.
const formatJsonDetail = (value: unknown) =>
  Option.liftPredicate(
    Formatter.formatJson(value, { space: 2 }),
    (formatted) => formatted !== "undefined",
  );

// oxlint-disable-next-line effect/no-unknown-parameters -- Serialization boundary accepts arbitrary values and validates/formats them before transport.
export const formatToolPayload = (payload: unknown): string =>
  Option.match(decodeEmptyRecord(payload), {
    onNone: () =>
      Option.match(decodeString(payload), {
        onNone: () => Option.getOrElse(formatJsonDetail(payload), () => "No structured detail."),
        onSome: (text) => text,
      }),
    onSome: () => "No arguments.",
  });
