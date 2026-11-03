/**
 * Serves the domain's `CustomerApi` and `StaffApi` as plain HTTP JSON, with
 * an OpenAPI document, generated from the Apis themselves
 * (`DomainHttp.toHttpApi`). Every call runs through the Api's own handlers
 * and `Session` middleware in process, so REST authorizes exactly as the
 * app's Domain RPC does.
 *
 * The Worker must mount this behind its auth session (`domainApi`), which
 * replaces any actor header a client sent; on its own it trusts that header.
 *
 * @module
 */
import * as DomainHttp from "@alchemy.run/domain/Http";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as Layer from "effect/Layer";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";

/** Where the generated REST surface lives. */
export const domainRestPrefix = "/api/rest";

const customer = DomainHttp.toHttpApi(CustomerApi);
const staff = DomainHttp.toHttpApi(StaffApi);

/**
 * `POST /api/rest/customer/<Command>`, `GET /api/rest/customer/<View>/:key`
 * and so on, and the same under `/api/rest/staff`.
 */
export const DomainRestApi = HttpApi.make("coffee-domain-rest")
  .add(customer.group.prefix(`${domainRestPrefix}/customer`))
  .add(staff.group.prefix(`${domainRestPrefix}/staff`));

const DomainRestLive = HttpApiBuilder.layer(DomainRestApi, {
  openapiPath: `${domainRestPrefix}/openapi.json`,
}).pipe(
  Layer.provide([customer.layerFor(DomainRestApi), staff.layerFor(DomainRestApi)]),
  Layer.provide(HttpServer.layerServices),
);

/**
 * The REST surface as one request handler, built once over the hosted model
 * and the Apis' middleware in context.
 */
export const domainRestHttp = HttpRouter.toHttpEffect(DomainRestLive);
