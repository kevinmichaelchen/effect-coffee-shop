import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import { makeOrderId, OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import * as Domain from "@alchemy.run/domain";
import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";
import { DrinkSelection, OrderAction, Viewer } from "./data.ts";

const protocol = (path: string) =>
  Layer.unwrap(
    Effect.sync(() => Domain.protocolHttp(new URL(`/api/${path}`, location.origin).href)),
  );
export const apiLayer = Layer.merge(
  CustomerApi.layerClient.pipe(Layer.provide(protocol("customer"))),
  StaffApi.layerClient.pipe(Layer.provide(protocol("staff"))),
).pipe(Layer.provideMerge(FetchHttpClient.layer));
export const viewer = HttpClient.get("/api/me").pipe(
  Effect.flatMap(HttpClientResponse.schemaBodyJson(Viewer)),
);
export const placeOrder = (items: ReadonlyArray<DrinkSelection>) =>
  Effect.gen(function* () {
    const target = yield* makeOrderId;
    const api = yield* CustomerApi.Client;
    const result = yield* api.PlaceOrder({ target, items });
    return result.reply.order;
  });
export const changeOrder = (target: OrderId, action: OrderAction) =>
  Effect.gen(function* () {
    const api = yield* StaffApi.Client;
    switch (action) {
      case "start-brewing":
        return (yield* api.StartBrewing({ target })).reply.order;
      case "mark-ready":
        return (yield* api.MarkReady({ target })).reply.order;
      case "pick-up":
        return (yield* api.PickUpOrder({ target })).reply.order;
      case "cancel":
        return (yield* api.CancelOrder({ target })).reply.order;
    }
  });
