/**
 * Composes and caches the Postgres-backed Coffee web backend for AWS Lambda.
 *
 * @module
 */
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import {
  authSchema,
  CoffeeDb,
  DrizzlePostgresCoffeeAppLive,
  DrizzlePostgresSchemaLive,
  DrizzlePostgresSchemaReady,
} from "@effect-coffee-shop/coffee-external-drizzle-postgres";
import { createCoffeeRequestServices, makeCoffeeBackend } from "../../host/coffee-backend.ts";
import type { CoffeeAuthDatabase } from "@effect-coffee-shop/coffee-auth/better-auth/shared";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";

const AwsAuthPersistenceLive = DrizzlePostgresSchemaLive.pipe(Layer.provideMerge(CoffeeDb.layer));
const AwsCoffeeRoutesLive = Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive);

const makeBetterAuthDatabase = Effect.gen(function* () {
  yield* DrizzlePostgresSchemaReady;
  const db = yield* CoffeeDb;

  return drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  });
});

const makeAwsBackend = () => {
  const persistenceRuntime = ManagedRuntime.make(AwsAuthPersistenceLive);
  const backend = makeCoffeeBackend({
    appLayer: DrizzlePostgresCoffeeAppLive,
    ensureAuthPersistence: async () => {
      await persistenceRuntime.runPromise(DrizzlePostgresSchemaReady);
    },
    persistence: {
      authDatabase: async (): Promise<CoffeeAuthDatabase> =>
        persistenceRuntime.runPromise(makeBetterAuthDatabase),
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

type AwsCoffeeBackend = ReturnType<typeof makeAwsBackend>;

let cachedBackend: AwsCoffeeBackend | undefined;

export const getAwsRuntimeBackend = (): AwsCoffeeBackend => {
  if (cachedBackend !== undefined) {
    return cachedBackend;
  }

  const backend = makeAwsBackend();
  cachedBackend = backend;
  return backend;
};

export const createAwsRequestServices = (actor: AppActor) => createCoffeeRequestServices(actor);
