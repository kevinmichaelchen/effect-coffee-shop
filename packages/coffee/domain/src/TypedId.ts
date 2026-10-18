/**
 * Prefixed, time-ordered ids (`order_01j…`): a prefix, then 26 Crockford
 * base32 characters, ten for the millisecond clock and sixteen random. Ids
 * are made by whoever sends the command that creates the instance, so a
 * retried command addresses the same instance.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";
import * as Schema from "effect/Schema";

const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";

const encodeTime = (millis: number): string =>
  Arr.makeBy(10, (index) => alphabet[Math.floor(millis / 32 ** (9 - index)) % 32] ?? "0").join("");

/** The shape every id with this prefix has. */
export const typedIdPattern = (prefix: string) =>
  Schema.isPattern(new RegExp(`^${prefix}_[0-7][${alphabet}]{25}$`));

/** A new id with this prefix, from the clock and randomness in context. */
export const generateTypedId = (prefix: string): Effect.Effect<string> =>
  Effect.gen(function* () {
    const millis = yield* Clock.currentTimeMillis;
    const random = yield* Effect.forEach(Arr.range(1, 16), () => Random.nextIntBetween(0, 31), {
      concurrency: 1,
    });
    return `${prefix}_${encodeTime(millis)}${random.map((index) => alphabet[index] ?? "0").join("")}`;
  });
