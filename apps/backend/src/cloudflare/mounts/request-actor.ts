import { resolveCloudflareActor } from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import { getCloudflareRuntimeBackend } from "../../composition/coffee-backend.ts";
import { readCloudflareRuntime, revealOptionalSecret, type CloudflareWorkerEnv } from "../env.ts";

export const resolveCloudflareRequestActor = async (input: {
  readonly env: CloudflareWorkerEnv;
  readonly request: Request;
}) => {
  const runtime = readCloudflareRuntime(input.env);
  const backend = getCloudflareRuntimeBackend(runtime);
  const secret = revealOptionalSecret(runtime.config.betterAuthSecret);

  await backend.ensureAuthPersistence();

  const actor = await resolveCloudflareActor({
    appLayer: backend.appLayer,
    db: backend.db,
    request: input.request,
    secret,
    staffUserIds: runtime.config.staffUserIds,
  });

  return {
    actor,
    backend,
    runtime,
  };
};
