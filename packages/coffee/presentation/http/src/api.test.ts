import { assert, describe, it } from "@effect/vitest";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import { CurrentActor, type AppActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { CoffeeHttpApi, CoffeeHttpApiLive } from "./api.ts";

const serveAs = (actor: AppActor) =>
  HttpRouter.serve(CoffeeHttpApiLive, { disableListenLog: true, disableLogger: true }).pipe(
    Layer.provide(Layer.succeed(CurrentActor)(actor)),
    Layer.provideMerge(NodeHttpServer.layerTest),
  );

describe("coffee REST endpoints", () => {
  it.effect("reports health without caching", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(CoffeeHttpApi);
      const health = yield* client.check();
      const response = yield* HttpClient.get("/health");

      assert.strictEqual(health.body.status, "ok");
      assert.strictEqual(response.headers["cache-control"], "no-store");
    }).pipe(Effect.provide(serveAs({ kind: "anonymous" }))),
  );

  it.effect("serves the menu priced in cents", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(CoffeeHttpApi);
      const menu = yield* client.menu.list();

      assert.deepStrictEqual(
        menu.map((item) => [item.id, item.basePriceCents]),
        [
          ["espresso", 300],
          ["americano", 350],
          ["latte", 450],
          ["cappuccino", 425],
          ["cold-brew", 400],
          ["tea", 325],
        ],
      );
    }).pipe(Effect.provide(serveAs({ kind: "anonymous" }))),
  );

  it.effect("summarizes who is signed in, presenting the system as staff", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(CoffeeHttpApi);
      const me = yield* client.session.me();

      assert.deepStrictEqual(me, { kind: "staff", userId: "ops", displayName: "Ops" });
    }).pipe(
      Effect.provide(
        serveAs({ kind: "system", userId: CustomerId.make("ops"), displayName: "Ops" }),
      ),
    ),
  );
});
