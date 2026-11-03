/**
 * Exposes the hand-written Coffee tools over MCP.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as McpServer from "effect/ai/McpServer";
import type * as Tool from "effect/ai/Tool";
import type * as Toolkit from "effect/ai/Toolkit";
import type { OrderingContextView } from "@effect-coffee-shop/coffee-actions/schemas";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import {
  type AppActor,
  CurrentActor,
  isAuthenticatedActor,
} from "@effect-coffee-shop/coffee-application/CurrentActor";
import {
  toItemOptionsView,
  toMenuView,
  toOrderQuoteView,
  toOrderValidationView,
} from "@effect-coffee-shop/coffee-application/contracts";
import { isStaff } from "@effect-coffee-shop/coffee-domain/Actor";
import { makeCartItemId } from "@effect-coffee-shop/coffee-domain/Cart/CartItem.id";
import { makeCheckoutId } from "@effect-coffee-shop/coffee-domain/Cart/Checkout";
import { makeOrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { mainShop } from "@effect-coffee-shop/coffee-domain/Shop/Shop.id";
import { McpActor, withMcpActor } from "./actor.ts";
import { CoffeeActionToolkit } from "./action-toolkit.ts";

const annotateToolCall = (context: Toolkit.HandlerContext<Tool.Any>) =>
  Effect.annotateSpans("mcp.tool_call_id", context.toolCallId);

const actorContext = (actor: AppActor) =>
  Option.match(Option.liftPredicate(actor, isAuthenticatedActor), {
    onNone: () => ({ isSignedIn: false, isStaff: false }),
    onSome: (signedIn) => ({
      isSignedIn: true,
      isStaff: isStaff(signedIn),
      customerId: signedIn.userId,
      displayName: signedIn.displayName,
    }),
  });

/** Who the caller is, and fresh ids for the domain tools' new orders, cart lines and checkouts. */
const orderingContext = Effect.fn("CoffeeMcp.orderingContext")(function* () {
  const actor = yield* CurrentActor;
  const newIds = yield* Effect.all(
    { orderId: makeOrderId, cartItemId: makeCartItemId, checkoutId: makeCheckoutId },
    { concurrency: 1 },
  );
  const context: OrderingContextView = { ...actorContext(actor), shopId: mainShop, newIds };
  return context;
});

export const CoffeeActionToolsLive = McpServer.toolkit(CoffeeActionToolkit).pipe(
  Layer.provideMerge(
    CoffeeActionToolkit.toLayer(
      Effect.gen(function* () {
        const app = yield* CoffeeOrderApp;
        const actor = yield* McpActor;
        const runWithActor = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
          effect.pipe(withMcpActor, Effect.provideService(McpActor, actor));
        return {
          get_ordering_context: (_input, context) =>
            orderingContext().pipe(annotateToolCall(context), runWithActor),
          list_menu: (_input, context) =>
            app.listMenu.pipe(
              Effect.map((menu) => ({ menu: toMenuView(menu) })),
              annotateToolCall(context),
              runWithActor,
            ),
          get_item_options: (input, context) =>
            app
              .getItemOptions(input)
              .pipe(Effect.map(toItemOptionsView), annotateToolCall(context), runWithActor),
          validate_order: (input, context) =>
            app
              .validateOrder(input)
              .pipe(Effect.map(toOrderValidationView), annotateToolCall(context), runWithActor),
          quote_order: (input, context) =>
            app
              .quoteOrder(input)
              .pipe(Effect.map(toOrderQuoteView), annotateToolCall(context), runWithActor),
        };
      }),
    ),
  ),
);
