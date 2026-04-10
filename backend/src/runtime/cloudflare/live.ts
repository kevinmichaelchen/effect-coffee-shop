import type { D1Database } from "@cloudflare/workers-types";
import { D1Client } from "@effect/sql-d1";
import * as Layer from "effect/Layer";
import { SqlCoffeeAppLive } from "#external/live";

export const makeCloudflareCoffeeAppLive = (db: D1Database) =>
  SqlCoffeeAppLive.pipe(Layer.provide(D1Client.layer({ db })));
