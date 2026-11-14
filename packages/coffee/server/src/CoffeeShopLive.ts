/**
 * The coffee shop model and the platform that hosts it. The model, its
 * handlers and its Apis never change; the host is this one Layer. To move the
 * model, swap `DomainCloudflare.layerDurableObjects()` for
 * `DomainRivet.layerDurableObjects` or `DomainCluster.layerEntities`, which
 * load this file's default export on their nodes.
 *
 * @module
 */
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import * as Layer from "effect/Layer";

export default CoffeeShop.layer(CoffeeShopHandlers).pipe(
  Layer.provide(DomainCloudflare.layerDurableObjects()),
);
