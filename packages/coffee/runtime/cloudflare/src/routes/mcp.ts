/**
 * Routes the Coffee MCP HTTP route on the Cloudflare Worker.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import { cloudflareBindingNames, type CloudflareWorkerEnv } from "../env.ts";
import {
  requestPathIsOrStartsWith,
  routeResponse,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { createCloudflareRequestServices, getCloudflareRuntimeBackend } from "../backend.ts";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

const isMcpRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/mcp");

export const mcpRoute: HttpRoute<CloudflareWorkerEnv> = {
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

      return routeResponse(response);
    }),
};
