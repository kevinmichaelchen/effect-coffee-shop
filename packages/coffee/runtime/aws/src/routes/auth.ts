/**
 * Routes Better Auth and agent discovery routes on AWS Lambda.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import {
  requestPathEquals,
  requestPathIsOrStartsWith,
  routeResponse,
  rewriteRequestPath,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { createCoffeeAuth } from "@effect-coffee-shop/coffee-auth/better-auth/shared";
import { getAwsRuntimeBackend } from "../backend.ts";
import { revealSecret, type AwsRuntime } from "../env.ts";

const betterAuthUnavailableResponse = () =>
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", { status: 503 });

const isAgentDiscoveryRequest = (request: Request): boolean =>
  requestPathEquals(request, "/.well-known/agent-configuration");

const isAuthRequest = (request: Request): boolean =>
  requestPathIsOrStartsWith(request, "/api/auth");

const handleAuthRequest = Effect.fn("Aws.handleAuthRequest")(function* (
  request: Request,
  runtime: AwsRuntime,
) {
  return yield* Option.match(runtime.config.betterAuthSecret, {
    onNone: () => Effect.succeed(betterAuthUnavailableResponse()),
    onSome: (secret) => {
      const backend = getAwsRuntimeBackend();
      const ensurePersistence = Effect.promise(async () => backend.ensureAuthPersistence());
      const response = Effect.gen(function* () {
        const database = yield* Effect.promise(async () => backend.persistence.authDatabase());

        return yield* Effect.promise(async () =>
          createCoffeeAuth({
            appLayer: backend.appLayer,
            database,
            request,
            secret: revealSecret(secret),
          }).handler(request),
        );
      });

      return ensurePersistence.pipe(Effect.andThen(response));
    },
  });
});

export const agentDiscoveryRoute: HttpRoute<AwsRuntime> = {
  name: "agent-discovery",
  matches: isAgentDiscoveryRequest,
  handle: ({ env, request }) =>
    handleAuthRequest(rewriteRequestPath(request, "/api/auth/agent-configuration"), env).pipe(
      Effect.map(routeResponse),
    ),
};

export const authRoute: HttpRoute<AwsRuntime> = {
  name: "auth",
  matches: isAuthRequest,
  handle: ({ env, request }) => handleAuthRequest(request, env).pipe(Effect.map(routeResponse)),
};
