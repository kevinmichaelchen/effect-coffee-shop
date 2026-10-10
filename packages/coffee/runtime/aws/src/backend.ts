import * as Layer from "effect/Layer";
import {
  CoffeeDb,
  PgCoffeeClientLive,
  DrizzlePostgresCoffeeAppLive,
  DrizzlePostgresSchemaLive,
} from "@effect-coffee-shop/coffee-external-drizzle-postgres";
import { handleCoffeeRequest } from "@effect-coffee-shop/coffee-backend/http/backend";
import { transactionalAuthDatabase } from "@effect-coffee-shop/coffee-auth/database";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import type { AwsRuntime } from "./env.ts";

export const handleAwsCoffeeRequest = (request: Request, runtime: AwsRuntime) => {
  const database = PgCoffeeClientLive.pipe(
    Layer.provide(DrizzlePostgresSchemaLive.pipe(Layer.provide(CoffeeDb.layer))),
  );
  return handleCoffeeRequest({
    request,
    auth: runtime.config.auth,
    database: transactionalAuthDatabase(database),
    appLayer: DrizzlePostgresCoffeeAppLive,
    httpRoutes: CoffeeHttpApiLive,
    mcpRoutes: CoffeeMcpHttpLive,
  });
};
