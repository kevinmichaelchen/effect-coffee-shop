/**
 * Routes the Coffee MCP HTTP route on AWS Lambda.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import {
  requestPathIsOrStartsWith,
  routeResponse,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { createAwsRequestServices, getAwsRuntimeBackend } from "../backend.ts";
import type { AwsRuntime } from "../env.ts";

const isMcpRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/mcp");

export const mcpRoute: HttpRoute<AwsRuntime> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: ({ request }) =>
    Effect.gen(function* () {
      const backend = getAwsRuntimeBackend();

      yield* Effect.promise(async () => backend.ensureAuthPersistence());

      return routeResponse(
        yield* Effect.promise(async () =>
          backend.handler(request, createAwsRequestServices(systemActor)),
        ),
      );
    }),
};
