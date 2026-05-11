import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  toCartView,
  toCoffeeOrderView,
  toCoffeeOrdersView,
  toItemOptionsView,
  toMenuView,
  toOrderQuoteView,
  toOrderValidationView,
  toPendingOrderConfirmationView,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { CoffeeActionToolkit } from "@effect-coffee-shop/coffee-actions/toolkit";

export const CoffeeActionToolsLive = McpServer.toolkit(CoffeeActionToolkit).pipe(
  Layer.provideMerge(
    CoffeeActionToolkit.toLayer(
      CoffeeOrderApp.use((app) =>
        Effect.succeed({
          list_menu: () => app.listMenu().pipe(Effect.map(toMenuView)),
          get_item_options: (input) =>
            app.getItemOptions(input).pipe(Effect.map(toItemOptionsView)),
          validate_order: (input) =>
            app.validateOrder(input).pipe(Effect.map(toOrderValidationView)),
          quote_order: (input) => app.quoteOrder(input).pipe(Effect.map(toOrderQuoteView)),
          prepare_order_confirmation: (input) =>
            app.prepareOrderConfirmation(input).pipe(Effect.map(toPendingOrderConfirmationView)),
          prepare_cart_confirmation: () =>
            app.prepareCartConfirmation().pipe(Effect.map(toPendingOrderConfirmationView)),
          place_order: (input) => app.placeOrder(input).pipe(Effect.map(toCoffeeOrderView)),
          get_order: ({ orderId }) => app.getOrder(orderId).pipe(Effect.map(toCoffeeOrderView)),
          list_orders: (input) => app.listOrders(input).pipe(Effect.map(toCoffeeOrdersView)),
          start_brewing: ({ orderId }) =>
            app.startBrewing(orderId).pipe(Effect.map(toCoffeeOrderView)),
          mark_ready: ({ orderId }) => app.markReady(orderId).pipe(Effect.map(toCoffeeOrderView)),
          pick_up_order: ({ orderId }) =>
            app.pickUpOrder(orderId).pipe(Effect.map(toCoffeeOrderView)),
          cancel_order: ({ orderId }) =>
            app.cancelOrder(orderId).pipe(Effect.map(toCoffeeOrderView)),
          get_cart: () => app.getCart().pipe(Effect.map(toCartView)),
          add_cart_item: (input) => app.addCartItem(input).pipe(Effect.map(toCartView)),
          update_cart_item: (input) => app.updateCartItem(input).pipe(Effect.map(toCartView)),
          remove_cart_item: (input) => app.removeCartItem(input).pipe(Effect.map(toCartView)),
          clear_cart: () => app.clearCart().pipe(Effect.map(toCartView)),
          checkout_cart: (input) => app.checkoutCart(input).pipe(Effect.map(toCoffeeOrderView)),
        }),
      ),
    ),
  ),
  Layer.provide(CoffeeOrderApp.layer),
);
