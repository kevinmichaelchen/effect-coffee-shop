/**
 * Defines application error conversion and reporting helpers.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class PersistenceError extends Schema.TaggedError<PersistenceError>()(
  "PersistenceError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
  { httpApiStatus: 500 },
) {
  static refail =
    (message: string) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, PersistenceError, R> =>
      Effect.mapError(
        effect,
        (cause) =>
          new PersistenceError({
            message,
            cause,
          }),
      );
}

export class InternalAppError extends Schema.TaggedError<InternalAppError>()(
  "InternalAppError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
  { httpApiStatus: 500 },
) {}

export const internalAppErrorFromPersistence =
  (message: string) =>
  (error: PersistenceError): InternalAppError =>
    new InternalAppError({
      message,
      cause: error.cause ?? error,
    });
