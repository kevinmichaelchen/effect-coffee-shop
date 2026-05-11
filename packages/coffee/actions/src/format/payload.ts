import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const decodeEmptyRecord = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Never));
const decodeString = Schema.decodeUnknownOption(Schema.String);

export const formatToolPayload = (payload: unknown): string =>
  Option.match(decodeEmptyRecord(payload), {
    onNone: () =>
      Option.match(decodeString(payload), {
        onNone: () => JSON.stringify(payload, null, 2) ?? "No structured detail.",
        onSome: (text) => text,
      }),
    onSome: () => "No arguments.",
  });
