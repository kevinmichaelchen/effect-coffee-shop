/**
 * The coffee shop model on Cloudflare Durable Objects. The model, its handlers
 * and its Apis never change; the host is this one Layer. `RivetDocker.ts` is
 * the same model on Rivet.
 *
 * @module
 */
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import * as Layer from "effect/Layer";

export default CoffeeShop.layer(CoffeeShopHandlers).pipe(
  Layer.provide(DomainCloudflare.layerDurableObjects()),
);
