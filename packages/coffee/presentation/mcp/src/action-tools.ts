/**
 * Exposes Coffee actions as MCP tools.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as McpServer from "effect/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { McpActor, withMcpActor } from "./actor.ts";
import {
  type NoCheckoutSessionView,
  toCartView,
  toCheckoutSessionView,
  toCoffeeOrderView,
  toCoffeeOrdersView,
  toItemOptionsView,
  toMenuView,
  toOrderQuoteView,
  toOrderValidationView,
} from "@effect-coffee-shop/coffee-application/contracts";
import { CoffeeActionToolkit } from "./action-toolkit.ts";

const noCheckoutSessionView: NoCheckoutSessionView = {
  status: "no_checkout_session",
};

// oxlint-disable-next-line effect/prefer-option-over-null -- MCP callback contract permits an explicitly undefined toolCallId.
const annotateToolCall = (context: { readonly toolCallId?: string | undefined }) =>
  Effect.annotateSpans("mcp.tool_call_id", context.toolCallId);

export const CoffeeActionToolsLive = McpServer.toolkit(CoffeeActionToolkit).pipe(
  Layer.provideMerge(
    CoffeeActionToolkit.toLayer(
      Effect.gen(function* () {
        const app = yield* CoffeeOrderApp;
        const actor = yield* McpActor;
        const runWithActor = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
          effect.pipe(withMcpActor, Effect.provideService(McpActor, actor));
        return {
          list_menu: (_input, context) =>
            app.listMenu().pipe(
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
          place_order: (input, context) =>
            app
              .placeOrder(input)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runWithActor),
          get_order: ({ orderId }, context) =>
            app
              .getOrder(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runWithActor),
          list_orders: (input, context) =>
            app.listOrders(input).pipe(
              Effect.map((orders) => ({ orders: toCoffeeOrdersView(orders) })),
              annotateToolCall(context),
              runWithActor,
            ),
          start_brewing: ({ orderId }, context) =>
            app
              .startBrewing(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runWithActor),
          mark_ready: ({ orderId }, context) =>
            app
              .markReady(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runWithActor),
          pick_up_order: ({ orderId }, context) =>
            app
              .pickUpOrder(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runWithActor),
          cancel_order: ({ orderId }, context) =>
            app
              .cancelOrder(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runWithActor),
          get_cart: (_input, context) =>
            app.getCart().pipe(Effect.map(toCartView), annotateToolCall(context), runWithActor),
          add_cart_item: (input, context) =>
            app
              .addCartItem(input)
              .pipe(Effect.map(toCartView), annotateToolCall(context), runWithActor),
          update_cart_item: (input, context) =>
            app
              .updateCartItem(input)
              .pipe(Effect.map(toCartView), annotateToolCall(context), runWithActor),
          remove_cart_item: (input, context) =>
            app
              .removeCartItem(input)
              .pipe(Effect.map(toCartView), annotateToolCall(context), runWithActor),
          clear_cart: (_input, context) =>
            app.clearCart().pipe(Effect.map(toCartView), annotateToolCall(context), runWithActor),
          prepare_cart_checkout: (_input, context) =>
            app
              .prepareCartCheckout()
              .pipe(Effect.map(toCheckoutSessionView), annotateToolCall(context), runWithActor),
          get_checkout_session: (_input, context) =>
            app.getCurrentCheckoutSession().pipe(
              Effect.map((session) =>
                Option.match(session, {
                  onNone: () => noCheckoutSessionView,
                  onSome: toCheckoutSessionView,
                }),
              ),
              annotateToolCall(context),
              runWithActor,
            ),
          checkout_cart: (input, context) =>
            app
              .checkoutCart(input)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runWithActor),
        };
      }),
    ),
  ),
  Layer.provide(CoffeeOrderApp.layer),
);
