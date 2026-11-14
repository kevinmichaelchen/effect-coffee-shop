import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as Domain from "@alchemy.run/domain";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Socket from "effect/socket/Socket";

export type CustomerClient = Context.Service.Shape<typeof CustomerApi.Client>;
export type StaffClient = Context.Service.Shape<typeof StaffApi.Client>;

export const apiBaseUrl = import.meta.env.VITE_COFFEE_API_URL ?? "/api";

/**
 * The Domain Api clients speak Effect RPC to the Worker, which serves them on
 * the UI's origin, so the session cookie rides along. Calls go over HTTP
 * (NDJSON); each live read (`watch`) opens a WebSocket that the view's host
 * pushes every commit down. The URL is resolved when the client is first
 * used, not at import time.
 */
function protocolFor(path: string) {
  return Layer.unwrap(
    Effect.sync(() =>
      Domain.protocolWebSocket(new URL(`${apiBaseUrl}${path}`, globalThis.location.origin).href),
    ),
  );
}

export const customerRuntime = ManagedRuntime.make(
  CustomerApi.layerClient.pipe(
    Layer.provide(protocolFor("/customer")),
    Layer.provide(Layer.mergeAll(FetchHttpClient.layer, Socket.layerWebSocketConstructorGlobal)),
  ),
);

export const staffRuntime = ManagedRuntime.make(
  StaffApi.layerClient.pipe(
    Layer.provide(protocolFor("/staff")),
    Layer.provide(Layer.mergeAll(FetchHttpClient.layer, Socket.layerWebSocketConstructorGlobal)),
  ),
);

/**
 * Runs a Domain Api call on its managed runtime as an Effect. A defect in the
 * runtime stays a defect; Commands turn it into a failure Message.
 */
export const onRuntime =
  <R>(runtime: ManagedRuntime.ManagedRuntime<R, never>) =>
  <A, E>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E> =>
    Effect.promise(async () => runtime.runPromiseExit(effect)).pipe(Effect.flatten);
