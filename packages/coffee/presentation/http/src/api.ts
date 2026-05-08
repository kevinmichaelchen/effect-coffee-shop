import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { MenuSchema } from "@effect-coffee-shop/coffee-core/domain/menu";
import {
  CoffeeOrderSchema,
  CoffeeOrdersSchema,
  OrderIdSchema,
} from "@effect-coffee-shop/coffee-core/domain/order";
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
  ListOrdersRequestSchema,
  PlaceOrderRequestSchema,
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

class HealthApi extends HttpApiGroup.make("health", { topLevel: true }).add(
  HttpApiEndpoint.get("check", "/health", {
    success: HealthStatusSchema,
  }),
) {}

class MenuApi extends HttpApiGroup.make("menu")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: MenuSchema,
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
      success: CoffeeOrderSchema,
      error: [
        AuthenticationRequiredError,
        DrinkNotFoundError,
        InvalidOrderInputError,
        InternalAppError,
      ],
    }),
    HttpApiEndpoint.get("list", "/", {
      query: ListOrdersRequestSchema,
      success: CoffeeOrdersSchema,
      error: [AuthenticationRequiredError, InvalidOrderInputError, InternalAppError],
    }),
    HttpApiEndpoint.get("getById", "/:orderId", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [AuthenticationRequiredError, OrderNotFoundError, InternalAppError],
    }),
    HttpApiEndpoint.post("startBrewing", "/:orderId/start-brewing", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [
        AuthenticationRequiredError,
        InvalidOrderStatusTransitionError,
        OrderNotFoundError,
        StaffRoleRequiredError,
        InternalAppError,
      ],
    }),
    HttpApiEndpoint.post("markReady", "/:orderId/mark-ready", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [
        AuthenticationRequiredError,
        InvalidOrderStatusTransitionError,
        OrderNotFoundError,
        StaffRoleRequiredError,
        InternalAppError,
      ],
    }),
    HttpApiEndpoint.post("pickUp", "/:orderId/pick-up", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [
        AuthenticationRequiredError,
        InvalidOrderStatusTransitionError,
        OrderNotFoundError,
        StaffRoleRequiredError,
        InternalAppError,
      ],
    }),
    HttpApiEndpoint.post("cancel", "/:orderId/cancel", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [
        AuthenticationRequiredError,
        InvalidOrderStatusTransitionError,
        OrderNotFoundError,
        StaffRoleRequiredError,
        InternalAppError,
      ],
    }),
  )
  .prefix("/orders") {}

export class CoffeeHttpApi extends HttpApi.make("coffee-order-api")
  .add(HealthApi)
  .add(MenuApi)
  .add(SessionApi)
  .add(OrdersApi) {}

const HealthApiLive = HttpApiBuilder.group(CoffeeHttpApi, "health", (handlers) =>
  handlers.handle("check", () => Effect.succeed(HEALTH_STATUS)),
);

const MenuApiLive = HttpApiBuilder.group(CoffeeHttpApi, "menu", (handlers) =>
  handlers.handle("list", () => CoffeeOrderApp.use((app) => app.listMenu())),
);

const SessionApiLive = HttpApiBuilder.group(CoffeeHttpApi, "session", (handlers) =>
  handlers.handle("me", () =>
    Effect.gen(function* () {
      return toActorSummary(yield* CurrentActor);
    }),
  ),
);

const OrdersApiLive = HttpApiBuilder.group(CoffeeHttpApi, "orders", (handlers) =>
  handlers
    .handle("create", ({ payload }) => CoffeeOrderApp.use((app) => app.placeOrder(payload)))
    .handle("list", ({ query }) => CoffeeOrderApp.use((app) => app.listOrders(query)))
    .handle("getById", ({ params }) => CoffeeOrderApp.use((app) => app.getOrder(params.orderId)))
    .handle("startBrewing", ({ params }) =>
      CoffeeOrderApp.use((app) => app.startBrewing(params.orderId)),
    )
    .handle("markReady", ({ params }) => CoffeeOrderApp.use((app) => app.markReady(params.orderId)))
    .handle("pickUp", ({ params }) => CoffeeOrderApp.use((app) => app.pickUpOrder(params.orderId)))
    .handle("cancel", ({ params }) => CoffeeOrderApp.use((app) => app.cancelOrder(params.orderId))),
);

export const CoffeeHttpApiLive = Layer.provide(
  HttpApiBuilder.layer(CoffeeHttpApi, { openapiPath: "/openapi.json" }),
  [HealthApiLive, MenuApiLive, SessionApiLive, OrdersApiLive],
).pipe(Layer.provide(CoffeeOrderApp.layer));
