import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Socket from "effect/socket/Socket";

export const apiBaseUrl = import.meta.env.VITE_COFFEE_API_URL ?? "/api";

/**
 * The Domain Api clients speak Effect RPC to the Worker, which serves them on
 * the UI's origin, so the session cookie rides along. Calls go over HTTP
 * (NDJSON); each live read (`watch`) opens a WebSocket that the view's host
 * pushes every commit down. The URL is resolved when the client is built, not
 * at import time.
 */
function protocolFor(path: string) {
  return Layer.unwrap(
    Effect.sync(() =>
      Domain.protocolWebSocket(new URL(`${apiBaseUrl}${path}`, globalThis.location.origin).href),
    ),
  );
}

const transport = Layer.mergeAll(FetchHttpClient.layer, Socket.layerWebSocketConstructorGlobal);

/** The customer Api's client, built once for the app's life by Foldkit's `resources`. */
export const CustomerConnection = CustomerApi.layerClient.pipe(
  Layer.provide(protocolFor("/customer")),
  Layer.provide(transport),
);

/** The staff Api's client, built once for the app's life by Foldkit's `resources`. */
export const StaffConnection = StaffApi.layerClient.pipe(
  Layer.provide(protocolFor("/staff")),
  Layer.provide(transport),
);
