import { it, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";
import { OrderFeedServer } from "../src/OrderFeed.ts";
import { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { moneyFromCents } from "@effect-coffee-shop/coffee-domain/Money";
import { OrderFeed, FeedId } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
const address = OrderFeed.address(FeedId.make("customer:alice"));
const publisher = { role: "publisher", userId: "publisher" };
const order = Schema.decodeUnknownSync(CoffeeOrder)({
  id: "order_01j9z3k6a0x8s5v2c4b7n1m3p6",
  ownerUserId: "alice",
  customerName: "Alice",
  items: [
    {
      drinkId: "latte",
      drinkName: "Latte",
      size: "medium",
      milk: "whole",
      temperature: "hot",
      shots: 1,
      quantity: 1,
      unitPrice: moneyFromCents(518),
      lineTotal: moneyFromCents(518),
    },
  ],
  totalPrice: moneyFromCents(518),
  status: "pending",
  createdAt: DateTime.makeUnsafe("2026-10-28T10:00:00Z"),
});

it.effect(
  "private feeds reject other customers, customers reject staff reads, and only the publisher can write",
  () =>
    Effect.gen(function* () {
      const server = yield* OrderFeedServer.acquire;
      const authorize = (role: string, userId: string, id: string) =>
        server.authorize({
          principal: { role, userId },
          address: OrderFeed.address(FeedId.make(id)),
          state: { entries: [] },
          operation: { _tag: "subscribe" },
        });
      yield* authorize("customer", "alice", "customer:alice");
      yield* authorize("staff", "barista", "staff");
      expect(yield* Effect.flip(authorize("customer", "bob", "customer:alice"))).toMatchObject({
        reason: "Forbidden",
      });
      expect(yield* Effect.flip(authorize("customer", "alice", "staff"))).toMatchObject({
        reason: "Forbidden",
      });
      expect(
        yield* Effect.flip(
          server.authorize({
            principal: { role: "staff", userId: "barista" },
            address,
            state: { entries: [] },
            operation: {
              _tag: "action",
              action: "publish",
              namespace: "$source",
              commandId: "forged",
            },
          }),
        ),
      ).toMatchObject({ reason: "Forbidden" });
    }).pipe(Effect.scoped),
);

it.effect(
  "source codecs preserve order values and duplicate or out-of-order publications cannot regress state",
  () =>
    Effect.gen(function* () {
      const server = yield* OrderFeedServer.acquire;
      const slot = server.slots[0];
      if (slot === undefined) return yield* Effect.die("Missing source slot");
      const publish = slot.actions.get("publish");
      if (publish === undefined) return yield* Effect.die("Missing publish action");
      const encode = Schema.encodeSync(Schema.toCodecJson(OrderFeed.actions.publish.payload));
      const initial = yield* slot.initialize;
      const first = yield* publish(
        initial,
        encode({ order: { ...order, status: "ready" }, version: 3 }),
        publisher,
        address,
      );
      const firstPlan = yield* Match.value(first).pipe(
        Match.tag("Succeeded", ({ plan }) => Effect.succeed(plan)),
        Match.orElse(() => Effect.die("Publication rejected")),
      );
      const stale = yield* publish(
        firstPlan.state,
        encode({ order, version: 1 }),
        publisher,
        address,
      );
      const stalePlan = yield* Match.value(stale).pipe(
        Match.tag("Succeeded", ({ plan }) => Effect.succeed(plan)),
        Match.orElse(() => Effect.die("Duplicate rejected")),
      );
      expect(stalePlan.events).toEqual([]);
      expect(stalePlan.state).toEqual(firstPlan.state);
      const snapshot = yield* slot.snapshot(stalePlan.state);
      const decoded = Schema.decodeUnknownSync(Schema.toCodecJson(OrderFeed.spec.snapshot))(
        snapshot,
      );
      expect(decoded.orders[0]?.status).toBe("ready");
      expect(decoded.orders[0]?.totalPrice.minorUnits).toBe(order.totalPrice.minorUnits);
      expect(
        yield* Effect.flip(
          publish(
            initial,
            encode({ order, version: 1 }),
            publisher,
            OrderFeed.address(FeedId.make("customer:bob")),
          ),
        ),
      ).toMatchObject({ reason: "Forbidden" });
    }).pipe(Effect.scoped),
);
