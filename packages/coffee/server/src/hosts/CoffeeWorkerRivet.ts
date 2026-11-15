/**
 * The Coffee Worker on Cloudflare, with the model on Rivet in a local Docker
 * swarm. It is `CoffeeWorker` with the model's host swapped; see
 * `CoffeeServer.ts` for what it serves.
 *
 * @module
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { coffeeServer } from "../CoffeeServer.ts";
import { CloudflareAuth, coffeeWorkerSettings } from "./edge/Cloudflare.ts";
import RivetDocker from "./model/RivetDocker.ts";

export default class CoffeeWorkerRivet extends Cloudflare.Worker<CoffeeWorkerRivet>()(
  "CoffeeWorker",
  coffeeWorkerSettings(import.meta.url),
  coffeeServer.pipe(Effect.provide([RivetDocker, CloudflareAuth])),
) {}
