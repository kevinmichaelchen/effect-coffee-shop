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
import { buildCloudflareAuthDependencies } from "#presentation/auth/cloudflare-mount";
import { ensureAuthPersistence, resolveActor } from "#presentation/auth/server";

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
        const authDeps = buildCloudflareAuthDependencies(runtime);

        await ensureAuthPersistence(authDeps);

        const actor = await resolveActor({ ...authDeps, request });

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
