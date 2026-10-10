import * as Effect from "effect/Effect";
import {
  requestPathIsOrStartsWith,
  routeResponse,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { handleCloudflareCoffeeRequest } from "../backend.ts";
import type { CloudflareWorkerEnv } from "../env.ts";

export const authRoute: HttpRoute<CloudflareWorkerEnv> = {
  name: "auth",
  matches: (request) =>
    requestPathIsOrStartsWith(request, "/api/auth") ||
    requestPathIsOrStartsWith(request, "/oauth") ||
    requestPathIsOrStartsWith(request, "/.well-known"),
  handle: ({ request, env }) =>
    handleCloudflareCoffeeRequest(request, env).pipe(Effect.map(routeResponse)),
};
