import * as Effect from "effect/Effect";
import {
  requestPathIsOrStartsWith,
  routeResponse,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { handleAwsCoffeeRequest } from "../backend.ts";
import type { AwsRuntime } from "../env.ts";

export const mcpRoute: HttpRoute<AwsRuntime> = {
  name: "mcp",
  matches: (request) => requestPathIsOrStartsWith(request, "/mcp"),
  handle: ({ request, env }) =>
    handleAwsCoffeeRequest(request, env).pipe(Effect.map(routeResponse)),
};
