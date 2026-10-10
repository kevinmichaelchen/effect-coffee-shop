import * as Effect from "effect/Effect";
import {
  requestPathIsOrStartsWith,
  routeResponse,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { handleCloudflareCoffeeRequest } from "../backend.ts";
import type { CloudflareWorkerEnv } from "../env.ts";

export const mcpRoute: HttpRoute<CloudflareWorkerEnv> = {
  name: "mcp",
  matches: (request) => requestPathIsOrStartsWith(request, "/mcp"),
  handle: ({ request, env }) =>
    handleCloudflareCoffeeRequest(request, env).pipe(Effect.map(routeResponse)),
};
