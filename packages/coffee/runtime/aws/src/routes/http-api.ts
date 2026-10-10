import * as Effect from "effect/Effect";
import {
  requestPathIsOrStartsWith,
  routeResponse,
  type HttpRoute,
} from "@effect-coffee-shop/http-routing/route";
import { handleAwsCoffeeRequest } from "../backend.ts";
import type { AwsRuntime } from "../env.ts";
import { handleDirectHttpRequest } from "@effect-coffee-shop/coffee-backend/http/direct-auth";

export const httpApiRoute: HttpRoute<AwsRuntime> = {
  name: "api",
  matches: (request) => requestPathIsOrStartsWith(request, "/api"),
  handle: ({ request, env }) =>
    handleDirectHttpRequest(request, () =>
      handleAwsCoffeeRequest(request, env).pipe(Effect.map(routeResponse)),
    ),
};
