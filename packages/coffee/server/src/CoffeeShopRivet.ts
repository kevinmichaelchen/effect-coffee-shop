/**
 * The coffee shop model hosted on Rivet Durable Objects, with the control
 * plane and its nodes on a local single-node Docker swarm. Rivet's nodes load
 * this file's default export to run the model; the Worker provides the same
 * Layer and reaches the model through the control plane's gateway.
 *
 * It is the same model as `CoffeeShopLive`: only the host Layer differs.
 *
 * @module
 */
import * as Docker from "@alchemy.run/docker";
import * as DomainRivet from "@alchemy.run/domain/Rivet";
import * as Rivet from "@alchemy.run/rivet";
import * as RivetDocker from "@alchemy.run/rivet/Docker";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/**
 * The swarm's control plane gives callers `http://rivet-engine:6420`, a name
 * only its Docker network resolves. The Worker runs on the host, where the
 * engine's API is published at `endpoint`, so callers use that instead.
 */
const ControlPlane = Layer.effect(
  Rivet.Cluster,
  Effect.map(Rivet.Cluster, (cluster) => ({ ...cluster, clientEndpoint: cluster.endpoint })),
).pipe(
  Layer.provide(
    Layer.unwrap(
      Effect.map(Docker.Swarm("Swarm"), (swarm) =>
        RivetDocker.SwarmControlPlane("Rivet", { context: swarm }),
      ),
    ),
  ),
);

const Default = RivetDocker.SwarmPool("Default").pipe(Layer.provide(ControlPlane));

export default CoffeeShop.layer(CoffeeShopHandlers).pipe(
  Layer.provide(
    DomainRivet.layerDurableObjects({ name: "CoffeeShop", main: import.meta.url, pool: Default }),
  ),
);
