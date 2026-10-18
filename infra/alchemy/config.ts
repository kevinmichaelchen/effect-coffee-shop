/**
 * Reads and validates Alchemy deployment configuration from environment variables.
 *
 * @module
 */
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const booleanWithDefault = (name: string, defaultValue: boolean) =>
  Config.Boolean(name).pipe(Config.withDefault(defaultValue), Effect.orDie);

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
