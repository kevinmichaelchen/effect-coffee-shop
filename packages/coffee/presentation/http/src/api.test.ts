import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpBody from "effect/unstable/http/HttpBody";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import {
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { OrderIdSchema } from "@effect-coffee-shop/coffee-core/domain/order";
import { InternalAppError } from "@effect-coffee-shop/coffee-core/application/errors";
import { HttpApiPersistenceFailureTestLive, HttpApiTestLive } from "./test-support.ts";
import { CoffeeHttpApi } from "./api.ts";

const CreatedOrderResponseSchema = Schema.Struct({
  id: OrderIdSchema,
  status: Schema.Literal("pending"),
  totalPriceCents: Schema.Int,
  createdAt: Schema.String,
});

const orderPayload = {
  customerName: "Avery",
  items: [{ drinkId: "latte", size: "medium" }],
} as const;
const orderIdPattern = /^order_[0123456789abcdefghjkmnpqrstvwxyz]{26}$/;

describe("http api success responses", () => {
  it.effect("returns typed health response headers", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(CoffeeHttpApi);
      const health = yield* client.check();
      const response = yield* HttpClient.get("/health");

      assert.strictEqual(health.body.status, "ok");
      assert.strictEqual(health.headers["cache-control"], "no-store");
      assert.strictEqual(response.headers["cache-control"], "no-store");
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("creates orders through the typed client", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(CoffeeHttpApi);
      const [order, response] = yield* client.orders.create({
        payload: orderPayload,
        responseMode: "decoded-and-response",
      });

      assert.strictEqual(response.status, 200);
      assert.match(order.id, orderIdPattern);
      assert.strictEqual(order.status, "pending");
      assert.match(order.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("encodes createdAt as ISO JSON over HTTP", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.post("/orders", {
        body: HttpBody.jsonUnsafe(orderPayload),
      });
      const body = yield* Schema.decodeUnknownEffect(CreatedOrderResponseSchema)(
        yield* response.json,
      );

      assert.strictEqual(response.status, 200);
      assert.match(body.id, orderIdPattern);
      assert.strictEqual(body.status, "pending");
      assert.match(body.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    }).pipe(Effect.provide(HttpApiTestLive)),
  );
});

describe("http api error responses", () => {
  it.effect("maps invalid order input to 400", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.post("/orders", {
        body: HttpBody.jsonUnsafe({
          customerName: "   ",
          items: [{ drinkId: "latte", size: "medium" }],
        }),
      });
      const body = yield* Schema.decodeUnknownEffect(InvalidOrderInputError)(yield* response.json);

      assert.strictEqual(response.status, 400);
      assert.strictEqual(body._tag, "InvalidOrderInputError");
      assert.strictEqual(body.message, "customerName must not be blank");
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("maps missing orders to 404", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get("/orders/order_0000000000000000000000000z");
      const body = yield* Schema.decodeUnknownEffect(OrderNotFoundError)(yield* response.json);

      assert.strictEqual(response.status, 404);
      assert.strictEqual(body._tag, "OrderNotFoundError");
      assert.strictEqual(body.orderId, "order_0000000000000000000000000z");
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("maps invalid status transitions to 409", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(CoffeeHttpApi);
      const created = yield* client.orders.create({
        payload: orderPayload,
      });
      const response = yield* HttpClient.post(`/orders/${created.id}/mark-ready`);
      const body = yield* Schema.decodeUnknownEffect(InvalidOrderStatusTransitionError)(
        yield* response.json,
      );

      assert.strictEqual(response.status, 409);
      assert.strictEqual(body._tag, "InvalidOrderStatusTransitionError");
      assert.strictEqual(body.orderId, created.id);
      assert.strictEqual(body.from, "pending");
      assert.strictEqual(body.to, "ready");
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("maps persistence failures to 500 instead of defecting", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.post("/orders", {
        body: HttpBody.jsonUnsafe(orderPayload),
      });
      const body = yield* Schema.decodeUnknownEffect(InternalAppError)(yield* response.json);

      assert.strictEqual(response.status, 500);
      assert.strictEqual(body._tag, "InternalAppError");
      assert.strictEqual(body.message, "Unable to place order right now");
    }).pipe(Effect.provide(HttpApiPersistenceFailureTestLive)),
  );
});
