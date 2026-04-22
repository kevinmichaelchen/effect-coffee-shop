import * as Option from "effect/Option";
import { actorLogFields } from "#presentation/observability/logging";
import { readCloudflareRuntime, type CloudflareWorkerEnv } from "#presentation/cloudflare/context";
import { rejectDirectHttpBearerRequest } from "#presentation/cloudflare/direct-http-auth";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "#presentation/cloudflare/mount";
import {
  createCloudflareRequestServices,
  getCloudflareBackendHandler,
} from "#presentation/http/cloudflare-handler";
import { ensureCloudflareAuthPersistence, resolveCloudflareActor } from "#presentation/auth/server";

const isApiRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/api" || pathname.startsWith("/api/");
};

const rewriteApiRequest = (request: Request): Request => {
  const pathname = cloudflarePathname(request);
  const rewrittenPathname = pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return rewriteRequestPath(request, rewrittenPathname);
};

export const cloudflareHttpApiMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "api",
  matches: isApiRequest,
  handle: async ({ env, request }) =>
    Option.match(Option.fromNullishOr(rejectDirectHttpBearerRequest(request)), {
      onNone: async () => {
        const runtime = readCloudflareRuntime(env);

        await ensureCloudflareAuthPersistence({
          db: runtime.bindings.db,
          email: Option.getOrUndefined(runtime.bindings.email),
          secret: Option.getOrUndefined(runtime.config.betterAuthSecret),
        });

        const actor = await resolveCloudflareActor({
          db: runtime.bindings.db,
          email: Option.getOrUndefined(runtime.bindings.email),
          request,
          secret: Option.getOrUndefined(runtime.config.betterAuthSecret),
          staffUserIds: runtime.config.staffUserIds,
        });

        return cloudflareResponse(
          await getCloudflareBackendHandler(
            runtime.bindings.db,
            Option.getOrUndefined(runtime.bindings.email),
          )(rewriteApiRequest(request), createCloudflareRequestServices(actor)),
          actorLogFields(actor),
        );
      },
      onSome: async (response: Response) => cloudflareResponse(response),
    }),
};
