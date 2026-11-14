/**
 * Runs Coffee Shop with the model on Rivet Durable Objects: a Rivet control
 * plane and node pool on a local single-node Docker swarm, and the Workers
 * on Alchemy's local Cloudflare runtime. Destroying it tears the swarm down.
 *
 * The control plane is reached at `localhost`, so this stack is for
 * `alchemy dev` and tests; a deployed Worker would use a pool it can reach,
 * such as `RivetCloud.Pool`.
 *
 * @module
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Docker from "@alchemy.run/docker";
import * as Rivet from "@alchemy.run/rivet";
import CoffeeWorkerRivet from "@effect-coffee-shop/coffee-server/CoffeeWorkerRivet";
import * as Layer from "effect/Layer";
import { coffeeStackName } from "./shared.ts";
import { coffeeStack } from "./stack.ts";

export default coffeeStack({
  name: `${coffeeStackName}-rivet`,
  worker: CoffeeWorkerRivet,
  providers: Layer.mergeAll(Cloudflare.providers(), Docker.providers(), Rivet.providers()),
});
