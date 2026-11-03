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
import { CoffeeShop } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as Arr from "effect/Array";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as OpenApi from "effect/http-api/OpenApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";

/** Where the generated REST surface lives. */
export const domainRestPrefix = "/api/rest";

/** What each read endpoint (`<Name>.<operation>`) does, for the OpenAPI document. */
const readDescriptions = {
  get: (name: string) => `The current ${name} for the key; \`null\` if there is none yet.`,
  snapshot: (name: string) => `The current ${name} for the key, with the cursor it is valid at.`,
  list: (name: string) => `A page of ${name} entries for the key.`,
  watch: (name: string) => `Server-Sent Events: the ${name} for the key, then each change to it.`,
  events: (name: string) => `Server-Sent Events: the ${name} changes for the key, after a cursor.`,
};

const decodeReadOperation = Schema.decodeUnknownOption(
  Schema.Literals(["get", "snapshot", "list", "watch", "events"]),
);

/** A command endpoint's description is the command's own; a read's says what it returns. */
const descriptionOf = (endpoint: string) => {
  const [name = endpoint, operation] = endpoint.split(".");
  return Option.match(Option.fromUndefinedOr(operation), {
    onNone: () =>
      Arr.findFirst(CoffeeShop.commands, (command) => command.tag === name).pipe(
        Option.flatMapNullishOr((command) => SchemaAST.resolveDescription(command.ast)),
      ),
    onSome: (read) =>
      Option.map(decodeReadOperation(read), (operation) => readDescriptions[operation](name)),
  });
};

/** The Api's REST surface, with each endpoint described in the OpenAPI document. */
const describedHttpApi = <A extends DomainHttp.Publishable>(api: A) => {
  const surface = DomainHttp.toHttpApi(api);
  const endpoints = R.values(surface.group.endpoints).map((endpoint) =>
    Option.match(descriptionOf(endpoint.identifier), {
      onNone: () => endpoint,
      onSome: (description) => endpoint.annotate(OpenApi.Description, description),
    }),
  );
  return {
    ...surface,
    group: Option.match(Arr.match(endpoints, { onEmpty: Option.none, onNonEmpty: Option.some }), {
      onNone: () => surface.group,
      onSome: (nonEmpty) => HttpApiGroup.make(surface.group.identifier).add(...nonEmpty),
    }),
  };
};

const customer = describedHttpApi(CustomerApi);
const staff = describedHttpApi(StaffApi);

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
