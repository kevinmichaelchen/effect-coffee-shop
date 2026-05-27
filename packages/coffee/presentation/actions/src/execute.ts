/**
 * Executes named Coffee actions against the application service.
 *
 * @module
 */
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import type { CoffeeOrder, OrderId } from "@effect-coffee-shop/coffee-core/domain/order";
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
import {
  decodeCartItemIdInput,
  decodeCheckoutCartInput,
  decodeEmptyActionInput,
  decodeItemOptionsInput,
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodeOrderItemInput,
  decodePlaceOrderInput,
  decodeQuoteOrderInput,
  decodeUpdateCartItemInput,
} from "./schemas.ts";
import type { CoffeeActionName } from "./specs.ts";

export type CoffeeAppRunner = <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) => Promise<A>;
type CoffeeOrderAppService = Context.Service.Shape<typeof CoffeeOrderApp>;
type ActionInputDecoder<A> = (payload: unknown) => Effect.Effect<A, unknown>;

interface ActionContext {
  readonly payload: unknown;
  readonly runApp: CoffeeAppRunner;
}

export interface CoffeeActionExecutionInput {
  readonly action: CoffeeActionName;
  readonly payload: unknown;
  readonly runApp: CoffeeAppRunner;
}

type ActionHandler = (input: ActionContext) => Effect.Effect<unknown, unknown>;

const noCheckoutSessionView: NoCheckoutSessionView = {
  status: "no_checkout_session",
};

const payloadOrEmpty = (payload: unknown): unknown => payload ?? {};

const runAppEffect = <A, E>(
  input: ActionContext,
  effect: Effect.Effect<A, E, CoffeeOrderApp>,
): Effect.Effect<A, unknown> =>
  Effect.tryPromise({
    try: () => input.runApp(effect),
    catch: (error) => error,
  });

const runEmptyAction =
  <A, E>(runEffect: (app: CoffeeOrderAppService) => Effect.Effect<A, E>): ActionHandler =>
  (input) =>
    decodeEmptyActionInput(payloadOrEmpty(input.payload)).pipe(
      Effect.flatMap(() => runAppEffect(input, CoffeeOrderApp.use(runEffect))),
    );

const runDecodedAction =
  <Payload, A, E>(
    decode: ActionInputDecoder<Payload>,
    runEffect: (app: CoffeeOrderAppService, payload: Payload) => Effect.Effect<A, E>,
  ): ActionHandler =>
  (input) =>
    decode(payloadOrEmpty(input.payload)).pipe(
      Effect.flatMap((payload) =>
        runAppEffect(
          input,
          CoffeeOrderApp.use((app) => runEffect(app, payload)),
        ),
      ),
    );

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
  prepare_cart_checkout: runEmptyAction((app) =>
    app.prepareCartCheckout().pipe(Effect.map(toCheckoutSessionView)),
  ),
  get_checkout_session: runEmptyAction((app) =>
    app.getCurrentCheckoutSession().pipe(
      Effect.map((session) =>
        Option.match(session, {
          onNone: () => noCheckoutSessionView,
          onSome: toCheckoutSessionView,
        }),
      ),
    ),
  ),
  checkout_cart: runDecodedAction(decodeCheckoutCartInput, (app, payload) =>
    app.checkoutCart(payload).pipe(Effect.map(toCoffeeOrderView)),
  ),
} satisfies Record<CoffeeActionName, ActionHandler>;

export function executeCoffeeActionEffect(
  input: CoffeeActionExecutionInput,
): Effect.Effect<unknown, unknown> {
  return actionHandlers[input.action](input);
}

export async function executeCoffeeAction(input: CoffeeActionExecutionInput): Promise<unknown> {
  return Effect.runPromise(executeCoffeeActionEffect(input));
}
