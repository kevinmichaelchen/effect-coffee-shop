/**
 * Composes Drizzle/Postgres repositories and schema readiness into one layer.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { CoffeeDb } from "./db/Db.ts";
import { DrizzlePostgresSchemaLive } from "./db/migrate.ts";
import { DrizzlePostgresPersistenceLive } from "./db/persistence.ts";
import { DrizzleCartItemIdGeneratorLive } from "./repositories/DrizzleCartItemIdGenerator.ts";
import { DrizzleCartRepositoryLive } from "./repositories/DrizzleCartRepository.ts";
import { DrizzleCheckoutSessionIdGeneratorLive } from "./repositories/DrizzleCheckoutSessionIdGenerator.ts";
import { DrizzleCheckoutSessionRepositoryLive } from "./repositories/DrizzleCheckoutSessionRepository.ts";
import { DrizzleMenuRepositoryLive } from "./repositories/DrizzleMenuRepository.ts";
import { DrizzleOrderIdGeneratorLive } from "./repositories/DrizzleOrderIdGenerator.ts";
import { DrizzleOrderRepositoryLive } from "./repositories/DrizzleOrderRepository.ts";

export const DrizzlePostgresCoffeeRepositoriesLive = Layer.mergeAll(
  DrizzlePostgresPersistenceLive,
  DrizzleCartRepositoryLive,
  DrizzleCheckoutSessionRepositoryLive,
  DrizzleMenuRepositoryLive,
  DrizzleOrderRepositoryLive,
);

export const DrizzleCoffeeAppLayer = Layer.mergeAll(
  DrizzlePostgresCoffeeRepositoriesLive,
  DrizzleCartItemIdGeneratorLive,
  DrizzleCheckoutSessionIdGeneratorLive,
  DrizzleOrderIdGeneratorLive,
);

export const DrizzlePostgresCoffeeAppLive = DrizzleCoffeeAppLayer.pipe(
  Layer.provide(DrizzlePostgresSchemaLive),
  Layer.provide(CoffeeDb.layer),
);
