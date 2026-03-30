import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpBody from "effect/unstable/http/HttpBody";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import {
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "../src/domain/errors.ts";
import { OrderIdSchema } from "../src/domain/order.ts";
import { InMemoryCoffeeAppLive } from "../src/external/live.ts";
import { CoffeeHttpApi, CoffeeHttpApiLive } from "../src/presentation/http/api.ts";

const CreatedOrderResponseSchema = Schema.Struct({
  id: OrderIdSchema,
  status: Schema.Literal("pending"),
  createdAt: Schema.String,
});

const HttpApiTestLive = HttpRouter.serve(CoffeeHttpApiLive, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(Layer.provide(InMemoryCoffeeAppLive), Layer.provideMerge(NodeHttpServer.layerTest));

describe("http api", () => {
  it.effect("creates orders through the typed client", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(CoffeeHttpApi);
      const [order, response] = yield* client.orders.create({
        payload: {
          customerName: "Avery",
          drinkId: "latte",
          size: "medium",
        },
        responseMode: "decoded-and-response",
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(order.id, "order-0001");
      assert.strictEqual(order.status, "pending");
      assert.isTrue(DateTime.isUtc(order.createdAt));
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("encodes createdAt as ISO JSON over HTTP", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.post("/orders", {
        body: HttpBody.jsonUnsafe({
          customerName: "Avery",
          drinkId: "latte",
          size: "medium",
        }),
      });
      const body = Schema.decodeUnknownSync(CreatedOrderResponseSchema)(yield* response.json);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.id, "order-0001");
      assert.strictEqual(body.status, "pending");
      assert.match(body.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("maps invalid order input to 400", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.post("/orders", {
        body: HttpBody.jsonUnsafe({
          customerName: "   ",
          drinkId: "latte",
          size: "medium",
        }),
      });
      const body = Schema.decodeUnknownSync(InvalidOrderInputError)(yield* response.json);

      assert.strictEqual(response.status, 400);
      assert.strictEqual(body._tag, "InvalidOrderInputError");
      assert.strictEqual(body.message, "customerName must not be blank");
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("maps missing orders to 404", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get("/orders/order-9999");
      const body = Schema.decodeUnknownSync(OrderNotFoundError)(yield* response.json);

      assert.strictEqual(response.status, 404);
      assert.strictEqual(body._tag, "OrderNotFoundError");
      assert.strictEqual(body.orderId, "order-9999");
    }).pipe(Effect.provide(HttpApiTestLive)),
  );

  it.effect("maps invalid status transitions to 409", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(CoffeeHttpApi);
      const created = yield* client.orders.create({
        payload: {
          customerName: "Avery",
          drinkId: "latte",
          size: "medium",
        },
      });
      const response = yield* HttpClient.post(`/orders/${created.id}/mark-ready`);
      const body = Schema.decodeUnknownSync(InvalidOrderStatusTransitionError)(
        yield* response.json,
      );

      assert.strictEqual(response.status, 409);
      assert.strictEqual(body._tag, "InvalidOrderStatusTransitionError");
      assert.strictEqual(body.orderId, created.id);
      assert.strictEqual(body.from, "pending");
      assert.strictEqual(body.to, "ready");
    }).pipe(Effect.provide(HttpApiTestLive)),
  );
});
