/**
 * Routes the Coffee MCP HTTP route on the Cloudflare Worker.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import { cloudflareBindingNames, type CloudflareWorkerEnv } from "../env.ts";
import {
  requestPathIsOrStartsWith,
  fetchResponse,
  type FetchRoute,
} from "@effect-coffee-shop/fetch-host/route";
import { createCloudflareRequestServices, getCloudflareRuntimeBackend } from "../coffee-backend.ts";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

const isMcpRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/mcp");

export const cloudflareMcpRoute: FetchRoute<CloudflareWorkerEnv> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: ({ env, request }) =>
    Effect.gen(function* () {
      const backend = getCloudflareRuntimeBackend({
        bindings: {
          db: env[cloudflareBindingNames.db],
        },
      });

      yield* Effect.promise(async () => backend.ensureAuthPersistence());
      const response = yield* Effect.promise(async () =>
        backend.handler(request, createCloudflareRequestServices(systemActor)),
      );

      return fetchResponse(response);
    }),
};
