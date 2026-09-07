/**
 * Parses platform environment values shared across backend runtimes.
 *
 * @module
 */
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";

// oxlint-disable-next-line effect/prefer-option-over-null -- Native environment adapter accepts/emits undefined; decoded runtime configuration uses Option.
export const optionalTrimmedString = (value: string | undefined): Option.Option<string> =>
  Option.fromUndefinedOr(value).pipe(Option.map(Str.trim), Option.filter(Str.isNonEmpty));

export const optionalTrimmedRedactedString = (
  // oxlint-disable-next-line effect/prefer-option-over-null -- Native environment adapter accepts/emits undefined; decoded runtime configuration uses Option.
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

// oxlint-disable-next-line effect/prefer-option-over-null -- Native environment adapter accepts/emits undefined; decoded runtime configuration uses Option.
export const parseCsvSet = (value: string | undefined): ReadonlySet<string> =>
  // oxlint-disable-next-line effect/avoid-native-object-helpers -- The runtime port requires a native ReadonlySet; Effect HashSet has a different contract.
  new Set(
    Str.split(value ?? "", ",")
      .map(Str.trim)
      .filter(Str.isNonEmpty),
  );

export const revealOptionalSecret = (
  secret: Option.Option<Redacted.Redacted<string>>,
  // oxlint-disable-next-line effect/prefer-option-over-null -- Native environment adapter accepts/emits undefined; decoded runtime configuration uses Option.
): string | undefined => Option.getOrUndefined(Option.map(secret, Redacted.value));

export const revealSecret = (secret: Redacted.Redacted<string>): string => Redacted.value(secret);
