/**
 * Reads orders through the domain Apis in process, so each view's own
 * `validate` decides what the caller may see: a customer their own orders,
 * staff the whole queue. Calls carry the actor `McpActor` resolved in the
 * header `Session` authenticates, exactly as the generated MCP tools do.
 *
 * The clients are built once, with the registration layer, and closed over:
 * an MCP handler's services are request-level, so a resource may only ask its
 * middleware (here for `McpActor`) at that point.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { actorHeaders } from "@effect-coffee-shop/coffee-application/ActorHeader";
import {
  type AuthenticatedActor,
  authenticationRequiredError,
  type AuthenticationRequiredError,
  isAuthenticatedActor,
} from "@effect-coffee-shop/coffee-application/CurrentActor";
import {
  InternalAppError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-application/errors";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import type { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import type { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { mainShop } from "@effect-coffee-shop/coffee-domain/Shop/Shop.id";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import { McpActor } from "./actor.ts";

interface Clients {
  readonly customers: Effect.Success<typeof CustomerApi.clientInProcess>;
  readonly staff: Effect.Success<typeof StaffApi.clientInProcess>;
}

/** What the MCP resources and prompts read, once the clients are in scope. */
export interface OrderReads {
  /** Every order the caller may see: their own for a customer, the queue for staff. */
  readonly listOrders: Effect.Effect<
    ReadonlyArray<CoffeeOrder>,
    AuthenticationRequiredError | InternalAppError,
    McpActor
  >;
  /** One order as a ticket, read through the view that guards it. */
  readonly getOrder: (
    orderId: OrderId,
  ) => Effect.Effect<
    CoffeeOrder,
    AuthenticationRequiredError | OrderNotFoundError | InternalAppError,
    McpActor
  >;
}

const unavailable =
  (message: string) =>
  (cause: unknown): InternalAppError =>
    new InternalAppError({ message, cause });

/** The signed-in actor this MCP invocation acts for. */
const currentActor: Effect.Effect<
  AuthenticatedActor,
  AuthenticationRequiredError | InternalAppError,
  McpActor
> = Effect.flatMap(McpActor, ({ current }) =>
  current.pipe(Effect.filterOrFail(isAuthenticatedActor, authenticationRequiredError)),
);

const ordersIn = (view: Option.Option<{ readonly orders: ReadonlyArray<CoffeeOrder> }>) =>
  Option.match(view, {
    onNone: (): ReadonlyArray<CoffeeOrder> => [],
    onSome: ({ orders }) => orders,
  });

const makeOrderReads = ({ customers, staff }: Clients): OrderReads => {
  const customersOwnOrders = (actor: AuthenticatedActor) =>
    customers.CustomerOrders.get(actor.userId, { headers: actorHeaders(actor) });
  const staffQueue = (actor: AuthenticatedActor) =>
    staff.OrderQueue.get(mainShop, { headers: actorHeaders(actor) });
  const summaryOf = (actor: AuthenticatedActor, orderId: OrderId) =>
    actor.kind === "staff"
      ? staff.OrderSummary.get(orderId, { headers: actorHeaders(actor) })
      : customers.OrderSummary.get(orderId, { headers: actorHeaders(actor) });

  return {
    listOrders: Effect.gen(function* () {
      const actor = yield* currentActor;
      const listed = yield* (
        actor.kind === "staff" ? staffQueue(actor) : customersOwnOrders(actor)
      ).pipe(Effect.mapError(unavailable("Unable to list orders right now")));
      return ordersIn(Option.fromNullishOr(listed));
    }),
    getOrder: Effect.fn("CoffeeMcp.getOrder")(function* (orderId) {
      const actor = yield* currentActor;
      const summary = yield* summaryOf(actor, orderId).pipe(
        Effect.catchTag("NotYourOrder", () => Effect.succeed(null)),
        Effect.mapError(unavailable("Unable to load order right now")),
      );
      return yield* Option.fromNullishOr(summary?.order).pipe(
        Effect.fromOption,
        Effect.mapError(() => new OrderNotFoundError({ orderId })),
      );
    }),
  };
};

const clients = Effect.all(
  {
    customers: CustomerApi.clientInProcess,
    staff: StaffApi.clientInProcess,
  },
  { concurrency: 1 },
);

/** The reads, with both in-process clients acquired for the caller's scope. */
const orderReads = Effect.map(clients, makeOrderReads);

/**
 * A resource or prompt registered with the order reads closed over. Builds
 * the in-process clients once, in the registration layer's scope.
 */
export const withOrderReads = <A, E, R>(build: (reads: OrderReads) => Layer.Layer<A, E, R>) =>
  Layer.unwrap(Effect.map(orderReads, build));
