/**
 * Adapts Coffee application methods into MCP tool handlers.
 *
 * @module
 */
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import type { OrderId } from "@effect-coffee-shop/coffee-core/domain/order";
import {
  type CartItemIdRequest,
  type CheckoutCartRequest,
  type ItemOptionsRequest,
  type ListOrdersRequest,
  type NoCheckoutSessionView,
  type OrderItemInput,
  type PlaceOrderRequest,
  type QuoteOrderRequest,
  toCartView,
  toCheckoutSessionView,
  toCoffeeOrderView,
  toCoffeeOrdersView,
  toItemOptionsView,
  toMenuView,
  toOrderQuoteView,
  toOrderValidationView,
  type UpdateCartItemRequest,
} from "@effect-coffee-shop/coffee-core/application/contracts";

type CoffeeOrderAppService = Context.Service.Shape<typeof CoffeeOrderApp>;

const noCheckoutSessionView: NoCheckoutSessionView = {
  status: "no_checkout_session",
};

export function makeCoffeeActionHandlers(app: CoffeeOrderAppService) {
  return {
    list_menu: () => app.listMenu().pipe(Effect.map(toMenuView)),
    get_item_options: (input: ItemOptionsRequest) =>
      app.getItemOptions(input).pipe(Effect.map(toItemOptionsView)),
    validate_order: (input: QuoteOrderRequest) =>
      app.validateOrder(input).pipe(Effect.map(toOrderValidationView)),
    quote_order: (input: QuoteOrderRequest) =>
      app.quoteOrder(input).pipe(Effect.map(toOrderQuoteView)),
    place_order: (input: PlaceOrderRequest) =>
      app.placeOrder(input).pipe(Effect.map(toCoffeeOrderView)),
    get_order: (input: { readonly orderId: OrderId }) =>
      app.getOrder(input.orderId).pipe(Effect.map(toCoffeeOrderView)),
    list_orders: (input: ListOrdersRequest) =>
      app.listOrders(input).pipe(Effect.map(toCoffeeOrdersView)),
    start_brewing: (input: { readonly orderId: OrderId }) =>
      app.startBrewing(input.orderId).pipe(Effect.map(toCoffeeOrderView)),
    mark_ready: (input: { readonly orderId: OrderId }) =>
      app.markReady(input.orderId).pipe(Effect.map(toCoffeeOrderView)),
    pick_up_order: (input: { readonly orderId: OrderId }) =>
      app.pickUpOrder(input.orderId).pipe(Effect.map(toCoffeeOrderView)),
    cancel_order: (input: { readonly orderId: OrderId }) =>
      app.cancelOrder(input.orderId).pipe(Effect.map(toCoffeeOrderView)),
    get_cart: () => app.getCart().pipe(Effect.map(toCartView)),
    add_cart_item: (input: OrderItemInput) => app.addCartItem(input).pipe(Effect.map(toCartView)),
    update_cart_item: (input: UpdateCartItemRequest) =>
      app.updateCartItem(input).pipe(Effect.map(toCartView)),
    remove_cart_item: (input: CartItemIdRequest) =>
      app.removeCartItem(input).pipe(Effect.map(toCartView)),
    clear_cart: () => app.clearCart().pipe(Effect.map(toCartView)),
    prepare_cart_checkout: () => app.prepareCartCheckout().pipe(Effect.map(toCheckoutSessionView)),
    get_checkout_session: () =>
      app.getCurrentCheckoutSession().pipe(
        Effect.map((session) =>
          Option.match(session, {
            onNone: () => noCheckoutSessionView,
            onSome: toCheckoutSessionView,
          }),
        ),
      ),
    checkout_cart: (input: CheckoutCartRequest) =>
      app.checkoutCart(input).pipe(Effect.map(toCoffeeOrderView)),
  };
}
