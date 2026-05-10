import * as Option from "effect/Option";
import { readCloudflareRuntime, revealSecret, type CloudflareWorkerEnv } from "../env.ts";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import {
  createCloudflareAuth,
  ensureCloudflareAuthPersistence,
} from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";

const betterAuthUnavailableResponse = () =>
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", { status: 503 });

const isAgentDiscoveryRequest = (request: Request): boolean =>
  cloudflarePathname(request) === "/.well-known/agent-configuration";

const isAuthRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
};

const handleAuthRequest = async (request: Request, env: CloudflareWorkerEnv): Promise<Response> => {
  const runtime = readCloudflareRuntime(env);

  return Option.match(runtime.config.betterAuthSecret, {
    onNone: async () => betterAuthUnavailableResponse(),
    onSome: async (secret) => {
      await ensureCloudflareAuthPersistence({
        db: runtime.bindings.db,
      });

      return createCloudflareAuth({
        appLayer: makeCloudflareCoffeeAppLive(runtime.bindings.db),
        db: runtime.bindings.db,
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
