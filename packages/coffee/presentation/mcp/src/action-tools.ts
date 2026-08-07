/**
 * Exposes Coffee actions as MCP tools.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
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
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { CoffeeActionToolkit } from "./action-toolkit.ts";

const noCheckoutSessionView: NoCheckoutSessionView = {
  status: "no_checkout_session",
};

const annotateToolCall = (context: { readonly toolCallId?: string | undefined }) =>
  Effect.annotateSpans("mcp.tool_call_id", context.toolCallId);

export const CoffeeActionToolsLive = McpServer.toolkit(CoffeeActionToolkit).pipe(
  Layer.provideMerge(
    CoffeeActionToolkit.toLayer(
      CoffeeOrderApp.use((app) =>
        Effect.succeed({
          list_menu: (_input, context) =>
            app.listMenu().pipe(
              Effect.map((menu) => ({ menu: toMenuView(menu) })),
              annotateToolCall(context),
            ),
          get_item_options: (input, context) =>
            app
              .getItemOptions(input)
              .pipe(Effect.map(toItemOptionsView), annotateToolCall(context)),
          validate_order: (input, context) =>
            app
              .validateOrder(input)
              .pipe(Effect.map(toOrderValidationView), annotateToolCall(context)),
          quote_order: (input, context) =>
            app.quoteOrder(input).pipe(Effect.map(toOrderQuoteView), annotateToolCall(context)),
          place_order: (input, context) =>
            app.placeOrder(input).pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context)),
          get_order: ({ orderId }, context) =>
            app.getOrder(orderId).pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context)),
          list_orders: (input, context) =>
            app.listOrders(input).pipe(
              Effect.map((orders) => ({ orders: toCoffeeOrdersView(orders) })),
              annotateToolCall(context),
            ),
          start_brewing: ({ orderId }, context) =>
            app
              .startBrewing(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context)),
          mark_ready: ({ orderId }, context) =>
            app.markReady(orderId).pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context)),
          pick_up_order: ({ orderId }, context) =>
            app.pickUpOrder(orderId).pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context)),
          cancel_order: ({ orderId }, context) =>
            app.cancelOrder(orderId).pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context)),
          get_cart: (_input, context) =>
            app.getCart().pipe(Effect.map(toCartView), annotateToolCall(context)),
          add_cart_item: (input, context) =>
            app.addCartItem(input).pipe(Effect.map(toCartView), annotateToolCall(context)),
          update_cart_item: (input, context) =>
            app.updateCartItem(input).pipe(Effect.map(toCartView), annotateToolCall(context)),
          remove_cart_item: (input, context) =>
            app.removeCartItem(input).pipe(Effect.map(toCartView), annotateToolCall(context)),
          clear_cart: (_input, context) =>
            app.clearCart().pipe(Effect.map(toCartView), annotateToolCall(context)),
          prepare_cart_checkout: (_input, context) =>
            app
              .prepareCartCheckout()
              .pipe(Effect.map(toCheckoutSessionView), annotateToolCall(context)),
          get_checkout_session: (_input, context) =>
            app.getCurrentCheckoutSession().pipe(
              Effect.map((session) =>
                Option.match(session, {
                  onNone: () => noCheckoutSessionView,
                  onSome: toCheckoutSessionView,
                }),
              ),
              annotateToolCall(context),
            ),
          checkout_cart: (input, context) =>
            app.checkoutCart(input).pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context)),
        }),
      ),
    ),
  ),
  Layer.provide(CoffeeOrderApp.layer),
);
