/**
 * Composes and caches the D1-backed Coffee web backend for Cloudflare Workers.
 *
 * @module
 */
import type { D1Database } from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import {
  createCoffeeRequestServices,
  makeCoffeeBackend,
} from "@effect-coffee-shop/coffee-backend/http/backend";
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

type CachedCloudflareBackend = {
  readonly backend: CloudflareCoffeeBackend;
  readonly db: D1Database;
};

let cachedBackend = Option.none<CachedCloudflareBackend>();

const replaceCloudflareCoffeeBackend = (db: D1Database): CloudflareCoffeeBackend => {
  Option.map(cachedBackend, ({ backend }) => void backend.dispose());

  const backend = makeCloudflareBackend(db);
  cachedBackend = Option.some({ backend, db });
  return backend;
};

const getCloudflareCoffeeBackend = (db: D1Database): CloudflareCoffeeBackend =>
  cachedBackend.pipe(
    Option.filter((cached) => cached.db === db),
    Option.match({
      onNone: () => replaceCloudflareCoffeeBackend(db),
      onSome: ({ backend }) => backend,
    }),
  );

export const getCloudflareRuntimeBackend = (runtime: {
  readonly bindings: {
    readonly db: D1Database;
  };
}): CloudflareCoffeeBackend => getCloudflareCoffeeBackend(runtime.bindings.db);

export const createCloudflareRequestServices = (actor: AppActor) =>
  createCoffeeRequestServices(actor);
