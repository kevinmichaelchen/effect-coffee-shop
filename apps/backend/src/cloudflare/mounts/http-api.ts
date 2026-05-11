import * as Option from "effect/Option";
import { actorLogFields } from "@effect-coffee-shop/backend-host/logging";
import type { CloudflareWorkerEnv } from "../env.ts";
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
import { resolveCloudflareRequestActor } from "./request-actor.ts";

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
        const { actor, runtime } = await resolveCloudflareRequestActor({ env, request });

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
