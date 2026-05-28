/**
 * Resolves the current application actor for an AWS Lambda request.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import { resolveCoffeeActor } from "@effect-coffee-shop/coffee-auth/better-auth/shared";
import { getAwsRuntimeBackend } from "../coffee-backend.ts";
import { revealOptionalSecret, type AwsRuntime } from "../env.ts";

export const resolveAwsRequestActor = Effect.fn("Aws.resolveRequestActor")(function* (input: {
  readonly runtime: AwsRuntime;
  readonly request: Request;
}) {
  const backend = getAwsRuntimeBackend();
  const secret = revealOptionalSecret(input.runtime.config.betterAuthSecret);

  yield* Effect.promise(async () => backend.ensureAuthPersistence());

  const database = yield* Effect.promise(async () => backend.persistence.authDatabase());
  const actor = yield* Effect.promise(async () =>
    resolveCoffeeActor({
      appLayer: backend.appLayer,
      database,
      request: input.request,
      secret,
      staffUserIds: input.runtime.config.staffUserIds,
    }),
  );

  return {
    actor,
    backend,
    runtime: input.runtime,
  };
});
