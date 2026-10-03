import * as Effect from "effect/Effect";
import * as HttpServerError from "effect/http/HttpServerError";
import type * as HttpServerResponse from "effect/http/HttpServerResponse";

/**
 * Use the same response mapping as Alchemy's outer safeHttpEffect adapter.
 * The router has already emitted the sanitized wide event, so consuming the
 * cause here prevents Alchemy from logging its raw values a second time.
 */
export const toLambdaHttpResponse = <E, R>(
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  effect.pipe(
    Effect.catchCause((cause) =>
      HttpServerError.causeResponse(cause).pipe(Effect.map(([response]) => response)),
    ),
  );
