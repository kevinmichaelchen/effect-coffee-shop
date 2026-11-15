/**
 * The Coffee Worker on Cloudflare, with the model on Cloudflare Durable
 * Objects. See `CoffeeServer.ts` for what it serves.
 *
 * @module
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { coffeeServer } from "../CoffeeServer.ts";
import { CloudflareAuth, CloudflareTelemetry, coffeeWorkerSettings } from "./edge/Cloudflare.ts";
import { TelemetryRelayLive } from "./edge/TelemetryRelay.ts";
import DurableObjects from "./model/DurableObjects.ts";

export default class CoffeeWorker extends Cloudflare.Worker<CoffeeWorker>()(
  "CoffeeWorker",
  coffeeWorkerSettings(import.meta.url),
  coffeeServer.pipe(
    Effect.provide([DurableObjects, CloudflareAuth, CloudflareTelemetry, TelemetryRelayLive]),
  ),
) {}
