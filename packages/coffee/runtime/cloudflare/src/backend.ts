import * as Effect from "effect/Effect";
import { handleCoffeeRequest } from "@effect-coffee-shop/coffee-backend/http/backend";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import { d1AuthDatabase } from "@effect-coffee-shop/coffee-auth/database";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import { readCloudflareRuntime, type CloudflareWorkerEnv } from "./env.ts";

export const handleCloudflareCoffeeRequest = Effect.fn("Cloudflare.handleCoffeeRequest")(function* (
  request: Request,
  env: CloudflareWorkerEnv,
) {
  const runtime = yield* readCloudflareRuntime(env);
  return yield* handleCoffeeRequest({
    request,
    auth: runtime.config.auth,
    database: d1AuthDatabase(runtime.bindings.db),
    appLayer: makeCloudflareCoffeeAppLive(runtime.bindings.db),
    httpRoutes: CoffeeHttpApiLive,
    mcpRoutes: CoffeeMcpHttpLive,
  });
});
