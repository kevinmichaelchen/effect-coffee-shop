import * as BunServices from "@effect/platform-bun/BunServices";
import * as Layer from "effect/Layer";
import { SqlCoffeeAppLive, SqlCoffeeRepositoriesLive } from "#external/live";
import { BunSqlClientLive } from "./sqlite.ts";

export const BunCoffeeRepositoriesLive = SqlCoffeeRepositoriesLive.pipe(
  Layer.provide(BunSqlClientLive),
  Layer.provide(BunServices.layer),
);

export const BunCoffeeAppLive = SqlCoffeeAppLive.pipe(
  Layer.provide(BunSqlClientLive),
  Layer.provide(BunServices.layer),
);
