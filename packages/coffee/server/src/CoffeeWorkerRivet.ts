/**
 * The Coffee Worker on Cloudflare, with the model on Rivet Durable Objects
 * (`CoffeeShopRivet`). It is `CoffeeWorker` with the model's host swapped;
 * see `CoffeeServer.ts` for what it serves.
 *
 * @module
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { CloudflareAuth, coffeeWorkerSettings } from "./adapters/cloudflare.ts";
import { coffeeServer } from "./CoffeeServer.ts";
import CoffeeShopRivet from "./CoffeeShopRivet.ts";

export default class CoffeeWorkerRivet extends Cloudflare.Worker<CoffeeWorkerRivet>()(
  "CoffeeWorker",
  coffeeWorkerSettings(import.meta.url),
  coffeeServer.pipe(Effect.provide([CoffeeShopRivet, CloudflareAuth])),
) {}
