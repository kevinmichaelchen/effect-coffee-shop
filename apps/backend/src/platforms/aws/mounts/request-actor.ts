/**
 * Resolves the current application actor for an AWS Lambda request.
 *
 * @module
 */
import { resolveCoffeeActor } from "@effect-coffee-shop/coffee-auth/better-auth/shared";
import { getAwsRuntimeBackend } from "../coffee-backend.ts";
import { revealOptionalSecret, type AwsRuntime } from "../env.ts";

export const resolveAwsRequestActor = async (input: {
  readonly runtime: AwsRuntime;
  readonly request: Request;
}) => {
  const backend = getAwsRuntimeBackend();
  const secret = revealOptionalSecret(input.runtime.config.betterAuthSecret);

  await backend.ensureAuthPersistence();

  const actor = await resolveCoffeeActor({
    appLayer: backend.appLayer,
    database: await backend.persistence.authDatabase(),
    request: input.request,
    secret,
    staffUserIds: input.runtime.config.staffUserIds,
  });

  return {
    actor,
    backend,
    runtime: input.runtime,
  };
};
