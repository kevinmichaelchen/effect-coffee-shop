/**
 * Deploys Coffee Shop to Cloudflare, with the model on Durable Objects.
 *
 * @module
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare";
import CoffeeWorker from "@effect-coffee-shop/coffee-server/CoffeeWorker";
import * as Layer from "effect/Layer";
import { coffeeStackName } from "./shared.ts";
import { coffeeStack } from "./stack.ts";

export default coffeeStack({
  name: coffeeStackName,
  worker: CoffeeWorker,
  providers: Layer.mergeAll(Cloudflare.providers(), DomainCloudflare.providers()),
});
