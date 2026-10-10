import * as Effect from "effect/Effect";
import {
  requestPathIsOrStartsWith,
  routeResponse,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { handleCloudflareCoffeeRequest } from "../backend.ts";
import type { CloudflareWorkerEnv } from "../env.ts";
import { handleDirectHttpRequest } from "@effect-coffee-shop/coffee-backend/http/direct-auth";

export const httpApiRoute: HttpRoute<CloudflareWorkerEnv> = {
  name: "api",
  matches: (request) => requestPathIsOrStartsWith(request, "/api"),
  handle: ({ request, env }) =>
    handleDirectHttpRequest(request, () =>
      handleCloudflareCoffeeRequest(request, env).pipe(Effect.map(routeResponse)),
    ),
};
