import * as Match from "effect/Match";
import { OrderFeed } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
import { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { ProtocolError } from "@yielded/sync";
import { Server } from "@yielded/sync/server";
import { DurableObject } from "@yielded/sync-platform-cloudflare";
import { AlchemyServices } from "@yielded/sync-platform-alchemy-cf";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const FeedPrincipal = Schema.Struct({
  role: Schema.Literals(["customer", "staff", "publisher"]),
  userId: Schema.String,
});
const FeedState = Schema.Struct({
  entries: Schema.Array(Schema.Struct({ order: CoffeeOrder, version: Schema.Natural })),
});
export const OrderFeedServer = Server.make(OrderFeed, {
  allowUnboundCommands: true,
  principal: FeedPrincipal,
  state: FeedState,
  initialize: Effect.succeed({ entries: [] }),
  snapshot: (state) => ({ orders: state.entries.map((entry) => entry.order) }),
  authorize: ({ principal, address, operation }) => {
    const writing = Match.value(operation).pipe(
      Match.tag("action", "result", () => true),
      Match.orElse(() => false),
    );
    const allowed =
      principal.role === "publisher" ||
      (!writing &&
        (address.id === `customer:${principal.userId}` ||
          (address.id === "staff" && principal.role === "staff")));
    return allowed
      ? Effect.void
      : Effect.fail(
          new ProtocolError({ reason: "Forbidden", message: "This order feed is private." }),
        );
  },
  actions: {
    publish: ({ state, payload, address }) => {
      if (address.id !== "staff" && address.id !== `customer:${payload.order.ownerUserId}`)
        return Effect.fail(
          new ProtocolError({ reason: "Forbidden", message: "Order belongs to a different feed." }),
        );
      const previous = state.entries.find((entry) => entry.order.id === payload.order.id);
      if (previous !== undefined && previous.version >= payload.version)
        return Effect.succeed({ state, events: [], result: null });
      return Effect.succeed({
        state: {
          entries: [
            ...state.entries.filter((entry) => entry.order.id !== payload.order.id),
            payload,
          ],
        },
        events: [{ order: payload.order }],
        result: null,
      });
    },
  },
});
export const OrderFeedObject = DurableObject.make(OrderFeedServer, {
  storage: { namespace: "coffee-orders" },
}).provide(AlchemyServices("OrderFeedObject"));
