/**
 * Composes and caches the D1-backed Coffee web backend for Cloudflare Workers.
 *
 * @module
 */
import type { D1Database } from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import { createCoffeeRequestServices, makeCoffeeBackend } from "../../host/coffee-backend.ts";
import { makeCloudflareCoffeeAppLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import { ensureCloudflareAuthPersistence } from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";

const CloudflareCoffeeRoutesLive = Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive);

const makeCloudflareBackend = (db: D1Database) => {
  const appLayer = makeCloudflareCoffeeAppLive(db);

  return makeCoffeeBackend({
    appLayer,
    ensureAuthPersistence: async () => ensureCloudflareAuthPersistence({ db }),
    persistence: db,
    routes: CloudflareCoffeeRoutesLive,
  });
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

export const createCloudflareRequestServices = (actor: AppActor) =>
  createCoffeeRequestServices(actor);
