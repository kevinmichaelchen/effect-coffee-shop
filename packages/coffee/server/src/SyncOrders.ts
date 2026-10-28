import * as Domain from "@alchemy.run/domain";
import {
  coffeeShopMembers,
  CoffeeShopHandlers,
} from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { OrderSummary } from "@effect-coffee-shop/coffee-domain/Order/OrderSummary.view";
import { OrderPlaced } from "@effect-coffee-shop/coffee-domain/Order/PlaceOrder.command";
import { BrewingStarted } from "@effect-coffee-shop/coffee-domain/Order/StartBrewing.command";
import { OrderReady } from "@effect-coffee-shop/coffee-domain/Order/MarkReady.command";
import { OrderPickedUp } from "@effect-coffee-shop/coffee-domain/Order/PickUpOrder.command";
import { OrderCancelled } from "@effect-coffee-shop/coffee-domain/Order/CancelOrder.command";
import { FeedId, OrderFeed } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
import { Cloudflare } from "@yielded/sync-platform-cloudflare";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { OrderFeedObject } from "./OrderFeed.ts";

export class SyncOrders extends Domain.Policy("SyncOrders", {
  from: OrderSummary,
  on: [OrderPlaced, BrewingStarted, OrderReady, OrderPickedUp, OrderCancelled],
}) {}

const publish =
  (
    feeds: Effect.Success<typeof OrderFeedObject>,
    order: CoffeeOrder,
    envelope: { readonly stream: string; readonly seq: number },
  ) =>
  (id: string) =>
    Effect.gen(function* () {
      const client = yield* Cloudflare.client(OrderFeed, {
        address: OrderFeed.address(FeedId.make(id)),
        identity: {
          actorId: "publisher",
          principal: { role: "publisher", userId: "publisher" },
          expiresAtMillis: (yield* Clock.currentTimeMillis) + 60_000,
        },
        fetch: (request) =>
          feeds
            .getByName(`orders:${id}`)
            .fetch(HttpServerRequest.fromWeb(request))
            .pipe(Effect.map(HttpServerResponse.toWeb)),
      });
      yield* client.execute(OrderFeed.actions.publish, {
        commandId: `${envelope.stream}:${envelope.seq}`,
        admittedGeneration: null,
        payload: { order, version: envelope.seq },
      });
    }).pipe(Effect.scoped, Effect.orDie);

const SyncOrdersLive = SyncOrders.toLayer(
  Effect.gen(function* () {
    const feeds = yield* OrderFeedObject;
    return Effect.fn("SyncOrders.publish")(function* ({ state, envelope }) {
      if (state === null || state.order === null) return;
      const order = state.order;
      yield* Effect.forEach(
        [`customer:${order.ownerUserId}`, "staff"],
        publish(feeds, order, envelope),
        { concurrency: 1, discard: true },
      );
    });
  }),
);

export class SyncedCoffeeShop extends Domain.Model("CoffeeShop", {
  ...coffeeShopMembers,
  policies: [...coffeeShopMembers.policies, SyncOrders],
}) {}
export const SyncedCoffeeShopHandlers = Layer.merge(CoffeeShopHandlers, SyncOrdersLive);
