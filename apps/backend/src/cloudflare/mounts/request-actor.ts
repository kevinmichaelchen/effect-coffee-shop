import {
  ensureCloudflareAuthPersistence,
  resolveCloudflareActor,
} from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import { readCloudflareRuntime, revealOptionalSecret, type CloudflareWorkerEnv } from "../env.ts";

export const resolveCloudflareRequestActor = async (input: {
  readonly env: CloudflareWorkerEnv;
  readonly request: Request;
}) => {
  const runtime = readCloudflareRuntime(input.env);
  const secret = revealOptionalSecret(runtime.config.betterAuthSecret);
  const appLayer = makeCloudflareCoffeeAppLive(runtime.bindings.db);

  await ensureCloudflareAuthPersistence({
    db: runtime.bindings.db,
  });

  const actor = await resolveCloudflareActor({
    appLayer,
    db: runtime.bindings.db,
    request: input.request,
    secret,
    staffUserIds: runtime.config.staffUserIds,
  });

  return {
    actor,
    appLayer,
    runtime,
  };
};
