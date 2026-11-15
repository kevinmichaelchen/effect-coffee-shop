/**
 * Deploys Coffee Shop to Cloudflare, with the model on Durable Objects.
 *
 * @module
 */
import CoffeeWorker from "@effect-coffee-shop/coffee-server/hosts/CoffeeWorker";
import { coffeeStackName } from "./shared.ts";
import { coffeeStack } from "./stack.ts";

export default coffeeStack({ name: coffeeStackName, worker: CoffeeWorker });
