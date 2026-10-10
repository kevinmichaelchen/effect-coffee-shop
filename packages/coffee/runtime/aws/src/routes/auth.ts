import * as Effect from "effect/Effect";
import {
  requestPathIsOrStartsWith,
  routeResponse,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { handleAwsCoffeeRequest } from "../backend.ts";
import type { AwsRuntime } from "../env.ts";

export const authRoute: HttpRoute<AwsRuntime> = {
  name: "auth",
  matches: (request) =>
    requestPathIsOrStartsWith(request, "/api/auth") ||
    requestPathIsOrStartsWith(request, "/oauth") ||
    requestPathIsOrStartsWith(request, "/.well-known"),
  handle: ({ request, env }) =>
    handleAwsCoffeeRequest(request, env).pipe(Effect.map(routeResponse)),
};
