/**
 * Routes Better Auth and agent discovery routes on the Cloudflare Worker.
 *
 * @module
 */
import * as Option from "effect/Option";
import * as Effect from "effect/Effect";
import { getCloudflareRuntimeBackend } from "../backend.ts";
import { readCloudflareRuntime, revealSecret, type CloudflareWorkerEnv } from "../env.ts";
import {
  requestPathEquals,
  requestPathIsOrStartsWith,
  routeResponse,
  rewriteRequestPath,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { createCloudflareAuth } from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";

const betterAuthUnavailableResponse = () =>
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", { status: 503 });

const isAgentDiscoveryRequest = (request: Request): boolean =>
  requestPathEquals(request, "/.well-known/agent-configuration");

const isAuthRequest = (request: Request): boolean =>
  requestPathIsOrStartsWith(request, "/api/auth");

const handleAuthRequest = Effect.fn("Cloudflare.handleAuthRequest")(function* (
  request: Request,
  env: CloudflareWorkerEnv,
) {
  const runtime = yield* readCloudflareRuntime(env);

  return yield* Option.match(runtime.config.betterAuthSecret, {
    onNone: () => Effect.succeed(betterAuthUnavailableResponse()),
    onSome: (secret) => {
      const backend = getCloudflareRuntimeBackend(runtime);
      const ensurePersistence = Effect.promise(async () => backend.ensureAuthPersistence());
      const response = Effect.promise(async () =>
        createCloudflareAuth({
          appLayer: backend.appLayer,
          db: backend.persistence,
          request,
          secret: revealSecret(secret),
        }).handler(request),
      );

      return ensurePersistence.pipe(Effect.andThen(response));
    },
  });
});

export const agentDiscoveryRoute: HttpRoute<CloudflareWorkerEnv> = {
  name: "agent-discovery",
  matches: isAgentDiscoveryRequest,
  handle: ({ env, request }) =>
    handleAuthRequest(rewriteRequestPath(request, "/api/auth/agent-configuration"), env).pipe(
      Effect.map(routeResponse),
    ),
};

export const authRoute: HttpRoute<CloudflareWorkerEnv> = {
  name: "auth",
  matches: isAuthRequest,
  handle: ({ env, request }) => handleAuthRequest(request, env).pipe(Effect.map(routeResponse)),
};
