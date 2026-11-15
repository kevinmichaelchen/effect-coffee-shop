import {
  type ActorSummary,
  CoffeeHttpApi,
  type MenuView,
} from "@effect-coffee-shop/coffee-http/contract";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientError from "effect/http/HttpClientError";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";
import { apiBaseUrl } from "./domain-clients.ts";

/** @public Named type an exported read fails with, so Commands can show its message. */
export class CoffeeReadFailed extends Schema.TaggedError<
  CoffeeReadFailed,
  { readonly brand: unique symbol }
>()("CoffeeReadFailed", {
  message: Schema.String,
}) {}

/** The boundary turns a client or decode failure into one sentence a visitor can act on. */
const messageFor = (error: HttpClientError.HttpClientError | Schema.SchemaError): string =>
  error._tag === "SchemaError"
    ? "The coffee shop sent an unexpected response. Try again in a moment."
    : "The coffee shop could not be reached. Check your connection and try again.";

const readFailed = <A, R>(
  read: Effect.Effect<A, HttpClientError.HttpClientError | Schema.SchemaError, R>,
): Effect.Effect<A, CoffeeReadFailed, R> =>
  Effect.mapError(read, (error) => new CoffeeReadFailed({ message: messageFor(error) }));

const coffeeApi = HttpApiClient.make(CoffeeHttpApi, {
  baseUrl: apiBaseUrl,
  // Timeout first, so each retried attempt gets its own budget.
  transformClient: (httpClient) =>
    httpClient.pipe(HttpClient.timeout("10 seconds"), HttpClient.retryTransient({ times: 2 })),
});

/** The menu is a plain read of the shop's own Worker, not part of a Domain Api. */
export const fetchMenu: Effect.Effect<MenuView, CoffeeReadFailed, HttpClient.HttpClient> =
  readFailed(Effect.flatMap(coffeeApi, (client) => client.menu.list()));

/** Who the session cookie belongs to, or the anonymous visitor. */
export const fetchViewer: Effect.Effect<ActorSummary, CoffeeReadFailed, HttpClient.HttpClient> =
  readFailed(Effect.flatMap(coffeeApi, (client) => client.session.me()));
