import { Option, Schema } from "effect";

const decodeMessage = Schema.decodeUnknownOption(Schema.Struct({ message: Schema.String }));

/** The message of a rejected model-runtime promise: its `message` field, else the value as text. */
export const causeMessage = (cause: unknown): string =>
  decodeMessage(cause).pipe(
    Option.match({ onNone: () => String(cause), onSome: ({ message }) => message }),
  );
