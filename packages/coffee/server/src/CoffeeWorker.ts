/**
 * The Coffee Worker with the model on Cloudflare Durable Objects
 * (`CoffeeShopLive`). See `CoffeeServer.ts` for what it serves.
 *
 * @module
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import CoffeeShopLive from "./CoffeeShopLive.ts";
import { coffeeWorker, coffeeWorkerSettings } from "./CoffeeServer.ts";

export default class CoffeeWorker extends Cloudflare.Worker<CoffeeWorker>()(
  "CoffeeWorker",
  coffeeWorkerSettings(import.meta.url),
  coffeeWorker(CoffeeShopLive),
) {}
