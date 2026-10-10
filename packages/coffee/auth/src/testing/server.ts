import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import type { SqlClient } from "effect/sql";
import type { SqlBatchCommit } from "@yielded/auth-persistence/Adapter";
import { AppActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
// oxlint-disable-next-line effect/no-service-constructor-imports -- Test composition root chooses auth adapters and owns its server lifetime.
import { makeCoffeeAuth, type AuthServerConfig } from "../server.ts";
import { AuthAdaptersLive } from "../adapters.ts";

/** Standalone adapter used by authentication integration tests. */
export const makeCoffeeAuthServer = <E>(
  config: AuthServerConfig,
  database: Layer.Layer<SqlClient.SqlClient | SqlBatchCommit, E>,
) => {
  const auth = makeCoffeeAuth(config, database, AuthAdaptersLive);
  const routes = Layer.merge(
    auth.routes,
    HttpRouter.add(
      "GET",
      "/api/auth/actor",
      Effect.flatMap(auth.actor(), HttpServerResponse.schemaJson(AppActor)),
    ).pipe(auth.http.middleware, Layer.provide(auth.auth)),
  ).pipe(Layer.provide(HttpServer.layerServices));
  const server = HttpRouter.toWebHandler(routes, { disableLogger: true });
  return {
    dispose: server.dispose,
    handler: (request: Request) => server.handler(request, Context.empty()),
  };
};
