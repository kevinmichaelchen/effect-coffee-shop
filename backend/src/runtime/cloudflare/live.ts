import type { D1Database } from "@cloudflare/workers-types";
import * as Layer from "effect/Layer";
import { D1Client } from "#effect-smol/sql/d1";
import { SqlCoffeeAppLive } from "#external/live";

export const makeCloudflareCoffeeAppLive = (db: D1Database) =>
  SqlCoffeeAppLive.pipe(Layer.provide(D1Client.layer({ db })));
