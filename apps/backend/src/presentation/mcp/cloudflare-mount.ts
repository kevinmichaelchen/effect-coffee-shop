import * as Option from "effect/Option";
import { readCloudflareRuntime, type CloudflareWorkerEnv } from "#presentation/cloudflare/context";
import {
  cloudflarePathname,
  cloudflareResponse,
  type CloudflareMount,
} from "#presentation/cloudflare/mount";
import {
  createCloudflareRequestServices,
  getCloudflareBackendHandler,
} from "#presentation/http/cloudflare-handler";
import { ensureCloudflareAuthPersistence } from "#presentation/auth/server";
import { systemActor } from "@effect-coffee-shop/coffee-core/service/CurrentActor";

const isMcpRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/mcp" || pathname.startsWith("/mcp/");
};

export const cloudflareMcpMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: async ({ env, request }) => {
    const runtime = readCloudflareRuntime(env);

    await ensureCloudflareAuthPersistence({
      db: runtime.bindings.db,
      secret: Option.getOrUndefined(runtime.config.betterAuthSecret),
    });

    return cloudflareResponse(
      await getCloudflareBackendHandler(runtime.bindings.db)(
        request,
        createCloudflareRequestServices(systemActor),
      ),
    );
  },
};
