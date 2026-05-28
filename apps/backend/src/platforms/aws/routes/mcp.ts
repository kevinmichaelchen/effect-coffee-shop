/**
 * Routes the Coffee MCP HTTP route on AWS Lambda.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import {
  requestPathIsOrStartsWith,
  fetchResponse,
  type FetchRoute,
} from "@effect-coffee-shop/fetch-host/route";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { createAwsRequestServices, getAwsRuntimeBackend } from "../coffee-backend.ts";
import type { AwsRuntime } from "../env.ts";

const isMcpRequest = (request: Request): boolean => requestPathIsOrStartsWith(request, "/mcp");

export const awsMcpRoute: FetchRoute<AwsRuntime> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: ({ request }) =>
    Effect.gen(function* () {
      const backend = getAwsRuntimeBackend();

      yield* Effect.promise(async () => backend.ensureAuthPersistence());

      return fetchResponse(
        yield* Effect.promise(async () =>
          backend.handler(request, createAwsRequestServices(systemActor)),
        ),
      );
    }),
};
