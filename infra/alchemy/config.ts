import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as String from "effect/String";

export const booleanWithDefault = (name: string, defaultValue: boolean) =>
  Config.boolean(name).pipe(Config.withDefault(defaultValue), Effect.orDie);

export const numberBetweenWithDefault = (input: {
  readonly defaultValue: number;
  readonly maximum: number;
  readonly minimum: number;
  readonly name: string;
}) =>
  Config.schema(
    Schema.Number.check(
      Schema.isBetween({
        maximum: input.maximum,
        minimum: input.minimum,
      }),
    ),
    input.name,
  ).pipe(Config.withDefault(input.defaultValue), Effect.orDie);

const optionalString = (name: string) =>
  Config.string(name).pipe(Config.option, Config.map(Option.getOrUndefined), Effect.orDie);

export const stringWithDefault = (name: string, defaultValue: string) =>
  Config.string(name).pipe(Config.withDefault(defaultValue), Effect.orDie);

export const optionalTrimmedString = (name: string) =>
  optionalString(name).pipe(
    Effect.map((value) => {
      const trimmed = value === undefined ? undefined : String.trim(value);

      return trimmed === undefined || trimmed === "" ? undefined : trimmed;
    }),
  );

export const optionalTrimmedRedacted = (name: string) =>
  Config.redacted(name).pipe(
    Config.option,
    Config.map(
      Option.flatMap((redacted) => {
        const trimmed = String.trim(Redacted.value(redacted));

        return trimmed === ""
          ? Option.none()
          : Option.some(Redacted.make(trimmed, { label: name }));
      }),
    ),
    Config.map(Option.getOrUndefined),
    Effect.orDie,
  );

export const optionalCsv = (name: string) =>
  optionalTrimmedString(name).pipe(
    Effect.map((value) =>
      value ? String.split(value, ",").map(String.trim).filter(String.isNonEmpty) : undefined,
    ),
  );
