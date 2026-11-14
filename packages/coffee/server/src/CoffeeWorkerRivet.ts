/**
 * The Coffee Worker with the model on Rivet Durable Objects
 * (`CoffeeShopRivet`). It is `CoffeeWorker` with one Layer swapped; see
 * `CoffeeServer.ts` for what it serves.
 *
 * @module
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import CoffeeShopRivet from "./CoffeeShopRivet.ts";
import { coffeeWorker, coffeeWorkerSettings } from "./CoffeeServer.ts";

export default class CoffeeWorkerRivet extends Cloudflare.Worker<CoffeeWorkerRivet>()(
  "CoffeeWorker",
  coffeeWorkerSettings(import.meta.url),
  coffeeWorker(CoffeeShopRivet),
) {}
