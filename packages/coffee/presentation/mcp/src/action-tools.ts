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
  CurrentActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
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

const runAsSystemActor = Effect.provideService(CurrentActor, systemActor);

export const CoffeeActionToolsLive = McpServer.toolkit(CoffeeActionToolkit).pipe(
  Layer.provideMerge(
    CoffeeActionToolkit.toLayer(
      CoffeeOrderApp.use((app) =>
        Effect.succeed({
          list_menu: (_input, context) =>
            app.listMenu().pipe(
              Effect.map((menu) => ({ menu: toMenuView(menu) })),
              annotateToolCall(context),
              runAsSystemActor,
            ),
          get_item_options: (input, context) =>
            app
              .getItemOptions(input)
              .pipe(Effect.map(toItemOptionsView), annotateToolCall(context), runAsSystemActor),
          validate_order: (input, context) =>
            app
              .validateOrder(input)
              .pipe(Effect.map(toOrderValidationView), annotateToolCall(context), runAsSystemActor),
          quote_order: (input, context) =>
            app
              .quoteOrder(input)
              .pipe(Effect.map(toOrderQuoteView), annotateToolCall(context), runAsSystemActor),
          place_order: (input, context) =>
            app
              .placeOrder(input)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runAsSystemActor),
          get_order: ({ orderId }, context) =>
            app
              .getOrder(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runAsSystemActor),
          list_orders: (input, context) =>
            app.listOrders(input).pipe(
              Effect.map((orders) => ({ orders: toCoffeeOrdersView(orders) })),
              annotateToolCall(context),
              runAsSystemActor,
            ),
          start_brewing: ({ orderId }, context) =>
            app
              .startBrewing(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runAsSystemActor),
          mark_ready: ({ orderId }, context) =>
            app
              .markReady(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runAsSystemActor),
          pick_up_order: ({ orderId }, context) =>
            app
              .pickUpOrder(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runAsSystemActor),
          cancel_order: ({ orderId }, context) =>
            app
              .cancelOrder(orderId)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runAsSystemActor),
          get_cart: (_input, context) =>
            app.getCart().pipe(Effect.map(toCartView), annotateToolCall(context), runAsSystemActor),
          add_cart_item: (input, context) =>
            app
              .addCartItem(input)
              .pipe(Effect.map(toCartView), annotateToolCall(context), runAsSystemActor),
          update_cart_item: (input, context) =>
            app
              .updateCartItem(input)
              .pipe(Effect.map(toCartView), annotateToolCall(context), runAsSystemActor),
          remove_cart_item: (input, context) =>
            app
              .removeCartItem(input)
              .pipe(Effect.map(toCartView), annotateToolCall(context), runAsSystemActor),
          clear_cart: (_input, context) =>
            app
              .clearCart()
              .pipe(Effect.map(toCartView), annotateToolCall(context), runAsSystemActor),
          prepare_cart_checkout: (_input, context) =>
            app
              .prepareCartCheckout()
              .pipe(Effect.map(toCheckoutSessionView), annotateToolCall(context), runAsSystemActor),
          get_checkout_session: (_input, context) =>
            app.getCurrentCheckoutSession().pipe(
              Effect.map((session) =>
                Option.match(session, {
                  onNone: () => noCheckoutSessionView,
                  onSome: toCheckoutSessionView,
                }),
              ),
              annotateToolCall(context),
              runAsSystemActor,
            ),
          checkout_cart: (input, context) =>
            app
              .checkoutCart(input)
              .pipe(Effect.map(toCoffeeOrderView), annotateToolCall(context), runAsSystemActor),
        }),
      ),
    ),
  ),
  Layer.provide(CoffeeOrderApp.layer),
);
