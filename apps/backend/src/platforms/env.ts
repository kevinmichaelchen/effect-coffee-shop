import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);

export const optionalTrimmedString = (value: string | undefined): Option.Option<string> => {
  const trimmed = decodeTrimmedString(value ?? "");

  return Option.liftPredicate(trimmed, (input) => input !== "");
};

export const optionalTrimmedRedactedString = (
  value: string | undefined,
  label: string,
): Option.Option<Redacted.Redacted<string>> =>
  Option.map(optionalTrimmedString(value), (trimmedSecret) =>
    Redacted.make(trimmedSecret, { label }),
  );

export const trimOptionalRedactedString = (
  value: Option.Option<Redacted.Redacted<string>>,
  label: string,
): Option.Option<Redacted.Redacted<string>> =>
  Option.flatMap(value, (secret) =>
    Option.map(optionalTrimmedString(Redacted.value(secret)), (trimmedSecret) =>
      Redacted.make(trimmedSecret, { label }),
    ),
  );

export const parseCsvSet = (value: string | undefined): ReadonlySet<string> =>
  new Set(
    (value ?? "")
      .split(",")
      .map((entry) => decodeTrimmedString(entry))
      .filter((entry) => entry !== ""),
  );

export const revealOptionalSecret = (
  secret: Option.Option<Redacted.Redacted<string>>,
): string | undefined => Option.getOrUndefined(Option.map(secret, Redacted.value));

export const revealSecret = (secret: Redacted.Redacted<string>): string => Redacted.value(secret);
