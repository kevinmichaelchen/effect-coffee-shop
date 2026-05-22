/**
 * Composes and caches the D1-backed Coffee web backend for Cloudflare Workers.
 *
 * @module
 */
import type { D1Database } from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { emptyWebHandlerServices } from "@effect-coffee-shop/backend-host/request-services";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { createCoffeeWebHandler } from "@effect-coffee-shop/coffee-http/web-handler";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import { ensureCloudflareAuthPersistence } from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import {
  CurrentActor,
  type AppActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";

const makeCloudflareBackend = (db: D1Database) => {
  const appLayer = makeCloudflareCoffeeAppLive(db);
  const webHandler = createCoffeeWebHandler(
    Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
    appLayer,
  );

  return {
    appLayer,
    db,
    dispose: webHandler.dispose,
    ensureAuthPersistence: async () => ensureCloudflareAuthPersistence({ db }),
    handler: webHandler.handler,
  };
};

type CloudflareCoffeeBackend = ReturnType<typeof makeCloudflareBackend>;

let cachedBackend:
  | {
      backend: CloudflareCoffeeBackend;
      db: D1Database;
    }
  | undefined;

const getCloudflareCoffeeBackend = (db: D1Database): CloudflareCoffeeBackend => {
  if (cachedBackend?.db === db) {
    return cachedBackend.backend;
  }

  void cachedBackend?.backend.dispose();

  const backend = makeCloudflareBackend(db);

  cachedBackend = {
    backend,
    db,
  };

  return backend;
};

export const getCloudflareRuntimeBackend = (runtime: {
  readonly bindings: {
    readonly db: D1Database;
  };
}): CloudflareCoffeeBackend => getCloudflareCoffeeBackend(runtime.bindings.db);

export const createCloudflareRequestServices = (actor: AppActor): Context.Context<unknown> =>
  emptyWebHandlerServices().pipe(Context.add(CurrentActor, actor));
