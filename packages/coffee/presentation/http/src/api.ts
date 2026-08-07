/**
 * Defines the Coffee HTTP API groups, endpoints, and server handlers.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { OrderIdSchema } from "@effect-coffee-shop/coffee-core/domain/order";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  type AppActor,
  AuthenticationRequiredError,
  CurrentActor,
  StaffRoleRequiredError,
  anonymousActor,
  isAuthenticatedActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import {
  CoffeeOrderViewSchema,
  CoffeeOrdersViewSchema,
  ListOrdersRequestSchema,
  MenuViewSchema,
  PlaceOrderRequestSchema,
  toCoffeeOrderView,
  toCoffeeOrdersView,
  toMenuView,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { InternalAppError } from "@effect-coffee-shop/coffee-core/application/errors";

const HealthStatusSchema = Schema.Struct({
  status: Schema.Literal("ok"),
}).annotate({ identifier: "HealthStatus" });
const HEALTH_STATUS: typeof HealthStatusSchema.Type = { status: "ok" };

const ActorSummarySchema = Schema.Struct({
  displayName: Schema.optionalKey(Schema.String),
  kind: Schema.Literals(["anonymous", "customer", "staff"] as const),
  userId: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "ActorSummary" });

type ActorSummary = typeof ActorSummarySchema.Type;

const toActorSummary = (actor: AppActor): ActorSummary =>
  isAuthenticatedActor(actor)
    ? {
        displayName: actor.displayName,
        kind: actor.kind === "system" ? "staff" : actor.kind,
        userId: actor.userId,
      }
    : anonymousActor;

const orderIdParams = {
  orderId: OrderIdSchema,
};

const orderStatusErrors = [
  AuthenticationRequiredError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
  StaffRoleRequiredError,
  InternalAppError,
];

const orderStatusEndpoint = <Name extends string, Path extends `/${string}`>(
  name: Name,
  path: Path,
) =>
  HttpApiEndpoint.post(name, path, {
    params: orderIdParams,
    success: CoffeeOrderViewSchema,
    error: orderStatusErrors,
  });

class HealthApi extends HttpApiGroup.make("health", { topLevel: true }).add(
  HttpApiEndpoint.get("check", "/health", {
    success: HttpApiSchema.WithHeaders(HealthStatusSchema, {
      "cache-control": Schema.Literal("no-store"),
    }),
  }),
) {}

class MenuApi extends HttpApiGroup.make("menu")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: MenuViewSchema,
      error: InternalAppError,
    }),
  )
  .prefix("/menu") {}

class SessionApi extends HttpApiGroup.make("session")
  .add(
    HttpApiEndpoint.get("me", "/me", {
      success: ActorSummarySchema,
    }),
  )
  .prefix("/") {}

class OrdersApi extends HttpApiGroup.make("orders")
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: PlaceOrderRequestSchema,
      success: CoffeeOrderViewSchema,
      error: [
        AuthenticationRequiredError,
        DrinkNotFoundError,
        InvalidOrderInputError,
        InternalAppError,
      ],
    }),
    HttpApiEndpoint.get("list", "/", {
      query: ListOrdersRequestSchema,
      success: CoffeeOrdersViewSchema,
      error: [AuthenticationRequiredError, InvalidOrderInputError, InternalAppError],
    }),
    HttpApiEndpoint.get("getById", "/:orderId", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderViewSchema,
      error: [AuthenticationRequiredError, OrderNotFoundError, InternalAppError],
    }),
    orderStatusEndpoint("startBrewing", "/:orderId/start-brewing"),
    orderStatusEndpoint("markReady", "/:orderId/mark-ready"),
    orderStatusEndpoint("pickUp", "/:orderId/pick-up"),
    orderStatusEndpoint("cancel", "/:orderId/cancel"),
  )
  .prefix("/orders") {}

export class CoffeeHttpApi extends HttpApi.make("coffee-order-api")
  .add(HealthApi)
  .add(MenuApi)
  .add(SessionApi)
  .add(OrdersApi) {}

const HealthApiLive = HttpApiBuilder.group(CoffeeHttpApi, "health", (handlers) =>
  handlers.handle("check", () =>
    Effect.succeed(
      HttpApiSchema.withHeaders({
        body: HEALTH_STATUS,
        headers: { "cache-control": "no-store" },
      }),
    ),
  ),
);

const MenuApiLive = HttpApiBuilder.group(CoffeeHttpApi, "menu", (handlers) =>
  handlers.handle("list", () =>
    CoffeeOrderApp.use((app) => app.listMenu().pipe(Effect.map(toMenuView))),
  ),
);

const SessionApiLive = HttpApiBuilder.group(CoffeeHttpApi, "session", (handlers) =>
  handlers.handle("me", () =>
    Effect.gen(function* () {
      return toActorSummary(yield* CurrentActor);
    }),
  ),
);

const OrdersApiLive = HttpApiBuilder.group(CoffeeHttpApi, "orders", (handlers) =>
  handlers.handleAll({
    create: ({ payload }) =>
      CoffeeOrderApp.use((app) => app.placeOrder(payload).pipe(Effect.map(toCoffeeOrderView))),
    list: ({ query }) =>
      CoffeeOrderApp.use((app) => app.listOrders(query).pipe(Effect.map(toCoffeeOrdersView))),
    getById: ({ params }) =>
      CoffeeOrderApp.use((app) => app.getOrder(params.orderId).pipe(Effect.map(toCoffeeOrderView))),
    startBrewing: ({ params }) =>
      CoffeeOrderApp.use((app) =>
        app.startBrewing(params.orderId).pipe(Effect.map(toCoffeeOrderView)),
      ),
    markReady: ({ params }) =>
      CoffeeOrderApp.use((app) =>
        app.markReady(params.orderId).pipe(Effect.map(toCoffeeOrderView)),
      ),
    pickUp: ({ params }) =>
      CoffeeOrderApp.use((app) =>
        app.pickUpOrder(params.orderId).pipe(Effect.map(toCoffeeOrderView)),
      ),
    cancel: ({ params }) =>
      CoffeeOrderApp.use((app) =>
        app.cancelOrder(params.orderId).pipe(Effect.map(toCoffeeOrderView)),
      ),
  }),
);

export const CoffeeHttpApiLive = Layer.provide(
  HttpApiBuilder.layer(CoffeeHttpApi, { openapiPath: "/openapi.json" }),
  [HealthApiLive, MenuApiLive, SessionApiLive, OrdersApiLive],
).pipe(Layer.provide(CoffeeOrderApp.layer));
