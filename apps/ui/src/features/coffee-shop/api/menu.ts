import type * as Effect from "effect/Effect";
import type * as HttpClient from "effect/http/HttpClient";
import type { MenuItem } from "#features/coffee-shop/lib/coffee.ts";
import { CoffeeApiError, Menu } from "#features/coffee-shop/lib/coffee-schemas.ts";
import {
  type HttpRequestError,
  type HttpResponseDecodeError,
  requestJson,
} from "#shared/lib/http.ts";
import { apiBaseUrl } from "./domain-clients.ts";

function readApiErrorMessage(error: CoffeeApiError): string {
  return error.message ?? error._tag ?? "Unknown API error";
}

/** The menu is a plain read of the shop's own Worker, not part of a Domain Api. */
export const fetchMenu: Effect.Effect<
  readonly MenuItem[],
  HttpRequestError | HttpResponseDecodeError,
  HttpClient.HttpClient
> = requestJson({
  errorSchema: CoffeeApiError,
  path: `${apiBaseUrl}/menu`,
  readErrorMessage: readApiErrorMessage,
  schema: Menu,
});
