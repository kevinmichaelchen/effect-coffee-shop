import * as Option from "effect/Option";
import { getCloudflareRuntimeBackend } from "../../composition/coffee-backend.ts";
import { readCloudflareRuntime, revealSecret, type CloudflareWorkerEnv } from "../env.ts";
import {
  cloudflarePathEquals,
  cloudflarePathIsOrStartsWith,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import { createCloudflareAuth } from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";

const betterAuthUnavailableResponse = () =>
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", { status: 503 });

const isAgentDiscoveryRequest = (request: Request): boolean =>
  cloudflarePathEquals(request, "/.well-known/agent-configuration");

const isAuthRequest = (request: Request): boolean =>
  cloudflarePathIsOrStartsWith(request, "/api/auth");

const handleAuthRequest = async (request: Request, env: CloudflareWorkerEnv): Promise<Response> => {
  const runtime = readCloudflareRuntime(env);

  return Option.match(runtime.config.betterAuthSecret, {
    onNone: async () => betterAuthUnavailableResponse(),
    onSome: async (secret) => {
      const backend = getCloudflareRuntimeBackend(runtime);

      await backend.ensureAuthPersistence();

      return createCloudflareAuth({
        appLayer: backend.appLayer,
        db: backend.db,
        request,
        secret: revealSecret(secret),
      }).handler(request);
    },
  });
};

export const cloudflareAgentDiscoveryMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "agent-discovery",
  matches: isAgentDiscoveryRequest,
  handle: async ({ env, request }) =>
    cloudflareResponse(
      await handleAuthRequest(rewriteRequestPath(request, "/api/auth/agent-configuration"), env),
    ),
};

export const cloudflareAuthMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "auth",
  matches: isAuthRequest,
  handle: async ({ env, request }) => cloudflareResponse(await handleAuthRequest(request, env)),
};
