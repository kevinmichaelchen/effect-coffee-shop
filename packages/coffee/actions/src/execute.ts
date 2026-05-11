import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import type { CoffeeOrder, OrderId } from "@effect-coffee-shop/coffee-core/domain/order";
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
import {
  decodeCartItemIdInput,
  decodeCheckoutCartInput,
  decodeEmptyActionInput,
  decodeItemOptionsInput,
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodeOrderItemInput,
  decodePlaceOrderInput,
  decodePrepareOrderConfirmationInput,
  decodeQuoteOrderInput,
  decodeUpdateCartItemInput,
} from "./schemas.ts";
import type { CoffeeActionName } from "./specs.ts";

export type CoffeeAppRunner = <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) => Promise<A>;
type CoffeeOrderAppService = Context.Service.Shape<typeof CoffeeOrderApp>;

interface ActionContext {
  readonly payload: unknown;
  readonly runApp: CoffeeAppRunner;
}

type ActionHandler = (input: ActionContext) => Promise<unknown>;

const payloadOrEmpty = (payload: unknown): unknown => payload ?? {};

const runEmptyAction =
  <A, E>(runEffect: (app: CoffeeOrderAppService) => Effect.Effect<A, E>): ActionHandler =>
  async (input) => {
    await decodeEmptyActionInput(payloadOrEmpty(input.payload));
    return input.runApp(CoffeeOrderApp.use(runEffect));
  };

const runDecodedAction =
  <Payload, A, E>(
    decode: (payload: unknown) => Promise<Payload>,
    runEffect: (app: CoffeeOrderAppService, payload: Payload) => Effect.Effect<A, E>,
  ): ActionHandler =>
  async (input) => {
    const payload = await decode(payloadOrEmpty(input.payload));
    return input.runApp(CoffeeOrderApp.use((app) => runEffect(app, payload)));
  };

const runOrderIdAction = <E>(
  runEffect: (app: CoffeeOrderAppService, orderId: OrderId) => Effect.Effect<CoffeeOrder, E>,
): ActionHandler =>
  runDecodedAction(decodeOrderIdInput, (app, payload) =>
    runEffect(app, payload.orderId).pipe(Effect.map(toCoffeeOrderView)),
  );

const actionHandlers = {
  list_menu: runEmptyAction((app) => app.listMenu().pipe(Effect.map(toMenuView))),
  get_item_options: runDecodedAction(decodeItemOptionsInput, (app, payload) =>
    app.getItemOptions(payload).pipe(Effect.map(toItemOptionsView)),
  ),
  validate_order: runDecodedAction(decodeQuoteOrderInput, (app, payload) =>
    app.validateOrder(payload).pipe(Effect.map(toOrderValidationView)),
  ),
  quote_order: runDecodedAction(decodeQuoteOrderInput, (app, payload) =>
    app.quoteOrder(payload).pipe(Effect.map(toOrderQuoteView)),
  ),
  prepare_order_confirmation: runDecodedAction(
    decodePrepareOrderConfirmationInput,
    (app, payload) =>
      app.prepareOrderConfirmation(payload).pipe(Effect.map(toPendingOrderConfirmationView)),
  ),
  prepare_cart_confirmation: runEmptyAction((app) =>
    app.prepareCartConfirmation().pipe(Effect.map(toPendingOrderConfirmationView)),
  ),
  place_order: runDecodedAction(decodePlaceOrderInput, (app, payload) =>
    app.placeOrder(payload).pipe(Effect.map(toCoffeeOrderView)),
  ),
  get_order: runOrderIdAction((app, orderId) => app.getOrder(orderId)),
  list_orders: runDecodedAction(decodeListOrdersInput, (app, payload) =>
    app.listOrders(payload).pipe(Effect.map(toCoffeeOrdersView)),
  ),
  start_brewing: runOrderIdAction((app, orderId) => app.startBrewing(orderId)),
  mark_ready: runOrderIdAction((app, orderId) => app.markReady(orderId)),
  pick_up_order: runOrderIdAction((app, orderId) => app.pickUpOrder(orderId)),
  cancel_order: runOrderIdAction((app, orderId) => app.cancelOrder(orderId)),
  get_cart: runEmptyAction((app) => app.getCart().pipe(Effect.map(toCartView))),
  add_cart_item: runDecodedAction(decodeOrderItemInput, (app, payload) =>
    app.addCartItem(payload).pipe(Effect.map(toCartView)),
  ),
  update_cart_item: runDecodedAction(decodeUpdateCartItemInput, (app, payload) =>
    app.updateCartItem(payload).pipe(Effect.map(toCartView)),
  ),
  remove_cart_item: runDecodedAction(decodeCartItemIdInput, (app, payload) =>
    app.removeCartItem(payload).pipe(Effect.map(toCartView)),
  ),
  clear_cart: runEmptyAction((app) => app.clearCart().pipe(Effect.map(toCartView))),
  checkout_cart: runDecodedAction(decodeCheckoutCartInput, (app, payload) =>
    app.checkoutCart(payload).pipe(Effect.map(toCoffeeOrderView)),
  ),
} satisfies Record<CoffeeActionName, ActionHandler>;

export async function executeCoffeeAction(input: {
  readonly action: CoffeeActionName;
  readonly payload: unknown;
  readonly runApp: CoffeeAppRunner;
}): Promise<unknown> {
  return actionHandlers[input.action](input);
}
