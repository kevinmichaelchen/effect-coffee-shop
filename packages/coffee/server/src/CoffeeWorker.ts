/**
 * The Coffee Worker on Cloudflare, with the model on Cloudflare Durable
 * Objects (`CoffeeShopLive`). See `CoffeeServer.ts` for what it serves.
 *
 * @module
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { CloudflareAuth, coffeeWorkerSettings } from "./adapters/cloudflare.ts";
import { coffeeServer } from "./CoffeeServer.ts";
import CoffeeShopLive from "./CoffeeShopLive.ts";

export default class CoffeeWorker extends Cloudflare.Worker<CoffeeWorker>()(
  "CoffeeWorker",
  coffeeWorkerSettings(import.meta.url),
  coffeeServer.pipe(Effect.provide([CoffeeShopLive, CloudflareAuth])),
) {}
