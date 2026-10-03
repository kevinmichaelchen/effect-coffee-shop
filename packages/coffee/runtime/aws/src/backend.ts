/**
 * Composes and caches the Postgres-backed Coffee web backend for AWS Lambda.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Option from "effect/Option";
import {
  CoffeeDb,
  DrizzlePostgresCoffeeAppLive,
  DrizzlePostgresSchemaLive,
} from "@effect-coffee-shop/coffee-external-drizzle-postgres";
import {
  createCoffeeRequestServices,
  makeCoffeeBackend,
} from "@effect-coffee-shop/coffee-backend/http/backend";
import type { CoffeeAuthDatabase } from "@effect-coffee-shop/coffee-auth/better-auth/shared";
import type { AppActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import { AwsAuthDatabase, AwsAuthDrizzle } from "./auth-database.ts";

const AwsAuthPersistenceLive = AwsAuthDatabase.layer.pipe(
  Layer.provide(
    Layer.mergeAll(
      DrizzlePostgresSchemaLive.pipe(Layer.provide(CoffeeDb.layer)),
      AwsAuthDrizzle.layer,
    ),
  ),
);
const AwsCoffeeRoutesLive = Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive);

const makeAwsBackend = () => {
  const persistenceRuntime = ManagedRuntime.make(AwsAuthPersistenceLive);
  const backend = makeCoffeeBackend({
    appLayer: DrizzlePostgresCoffeeAppLive,
    ensureAuthPersistence: async () => {
      await persistenceRuntime.runPromise(AwsAuthDatabase);
    },
    persistence: {
      authDatabase: async (): Promise<CoffeeAuthDatabase> =>
        persistenceRuntime.runPromise(AwsAuthDatabase),
    },
    routes: AwsCoffeeRoutesLive,
  });

  return {
    ...backend,
    dispose: async () => {
      await backend.dispose();
      await persistenceRuntime.dispose();
    },
  };
};

export type AwsCoffeeBackend = ReturnType<typeof makeAwsBackend>;

let cachedBackend = Option.none<AwsCoffeeBackend>();

const makeCachedAwsRuntimeBackend = (): AwsCoffeeBackend => {
  const backend = makeAwsBackend();
  cachedBackend = Option.some(backend);
  return backend;
};

export const getAwsRuntimeBackend = (): AwsCoffeeBackend =>
  Option.match(cachedBackend, {
    onNone: makeCachedAwsRuntimeBackend,
    onSome: (backend) => backend,
  });

export const createAwsRequestServices = (actor: AppActor) => createCoffeeRequestServices(actor);
