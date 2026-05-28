/**
 * Resolves the current application actor for a Cloudflare request.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import { resolveCloudflareActor } from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import { getCloudflareRuntimeBackend } from "../coffee-backend.ts";
import { readCloudflareRuntime, revealOptionalSecret, type CloudflareWorkerEnv } from "../env.ts";

export const resolveCloudflareRequestActor = Effect.fn("Cloudflare.resolveRequestActor")(
  function* (input: { readonly env: CloudflareWorkerEnv; readonly request: Request }) {
    const runtime = yield* readCloudflareRuntime(input.env);
    const backend = getCloudflareRuntimeBackend(runtime);
    const secret = revealOptionalSecret(runtime.config.betterAuthSecret);

    yield* Effect.promise(async () => backend.ensureAuthPersistence());

    const actor = yield* Effect.promise(async () =>
      resolveCloudflareActor({
        appLayer: backend.appLayer,
        db: backend.persistence,
        request: input.request,
        secret,
        staffUserIds: runtime.config.staffUserIds,
      }),
    );

    return {
      actor,
      backend,
      runtime,
    };
  },
);
