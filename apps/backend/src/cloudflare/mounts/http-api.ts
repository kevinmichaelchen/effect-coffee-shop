import * as Option from "effect/Option";
import { actorLogFields } from "@effect-coffee-shop/backend-host/logging";
import { readCloudflareRuntime, type CloudflareWorkerEnv } from "../env.ts";
import { rejectDirectHttpBearerRequest } from "../direct-http-auth.ts";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import {
  createCloudflareRequestServices,
  getCloudflareBackendHandler,
} from "../../composition/coffee-backend.ts";
import {
  ensureCloudflareAuthPersistence,
  resolveCloudflareActor,
} from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";

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
          secret: Option.getOrUndefined(runtime.config.betterAuthSecret),
        });

        const actor = await resolveCloudflareActor({
          appLayer: makeCloudflareCoffeeAppLive(runtime.bindings.db),
          db: runtime.bindings.db,
          request,
          secret: Option.getOrUndefined(runtime.config.betterAuthSecret),
          staffUserIds: runtime.config.staffUserIds,
        });

        return cloudflareResponse(
          await getCloudflareBackendHandler(runtime.bindings.db)(
            rewriteApiRequest(request),
            createCloudflareRequestServices(actor),
          ),
          actorLogFields(actor),
        );
      },
      onSome: async (response: Response) => cloudflareResponse(response),
    }),
};
