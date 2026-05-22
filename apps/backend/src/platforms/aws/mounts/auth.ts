/**
 * Mounts Better Auth and agent discovery routes on AWS Lambda.
 *
 * @module
 */
import * as Option from "effect/Option";
import {
  requestPathEquals,
  requestPathIsOrStartsWith,
  fetchResponse,
  rewriteRequestPath,
  type FetchMount,
} from "@effect-coffee-shop/backend-host/mount";
import { createCoffeeAuth } from "@effect-coffee-shop/coffee-auth/better-auth/shared";
import { getAwsRuntimeBackend } from "../coffee-backend.ts";
import { revealSecret, type AwsRuntime } from "../env.ts";

const betterAuthUnavailableResponse = () =>
  new Response("Better Auth is unavailable. Configure BETTER_AUTH_SECRET.", { status: 503 });

const isAgentDiscoveryRequest = (request: Request): boolean =>
  requestPathEquals(request, "/.well-known/agent-configuration");

const isAuthRequest = (request: Request): boolean =>
  requestPathIsOrStartsWith(request, "/api/auth");

const handleAuthRequest = async (request: Request, runtime: AwsRuntime): Promise<Response> =>
  Option.match(runtime.config.betterAuthSecret, {
    onNone: async () => betterAuthUnavailableResponse(),
    onSome: async (secret) => {
      const backend = getAwsRuntimeBackend();

      await backend.ensureAuthPersistence();

      return createCoffeeAuth({
        appLayer: backend.appLayer,
        database: await backend.persistence.authDatabase(),
        request,
        secret: revealSecret(secret),
      }).handler(request);
    },
  });

export const awsAgentDiscoveryMount: FetchMount<AwsRuntime> = {
  name: "agent-discovery",
  matches: isAgentDiscoveryRequest,
  handle: async ({ env, request }) =>
    fetchResponse(
      await handleAuthRequest(rewriteRequestPath(request, "/api/auth/agent-configuration"), env),
    ),
};

export const awsAuthMount: FetchMount<AwsRuntime> = {
  name: "auth",
  matches: isAuthRequest,
  handle: async ({ env, request }) => fetchResponse(await handleAuthRequest(request, env)),
};
