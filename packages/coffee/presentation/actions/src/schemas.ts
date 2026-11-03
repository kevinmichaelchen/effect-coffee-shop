/**
 * Defines action-layer input and error schemas shared by tool surfaces.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import { CartItemId } from "@effect-coffee-shop/coffee-domain/Cart/CartItem.id";
import { CheckoutId } from "@effect-coffee-shop/coffee-domain/Cart/Checkout";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { ShopId } from "@effect-coffee-shop/coffee-domain/Shop/Shop.id";
import { AuthenticationRequiredError } from "@effect-coffee-shop/coffee-application/CurrentActor";
import {
  DrinkNotFoundError,
  InternalAppError,
  InvalidOrderInputError,
} from "@effect-coffee-shop/coffee-application/errors";

/** What the hand-written tools can fail with: resolving the caller, and checking a proposed order. */
export const AppError = Schema.Union([
  AuthenticationRequiredError,
  DrinkNotFoundError,
  InvalidOrderInputError,
  InternalAppError,
]).annotate({ identifier: "AppError" });

export const EmptyActionInput = Schema.Record(Schema.String, Schema.Never);

/** Who an agent acts for, and fresh ids for the domain tools' targets and inputs. */
export const OrderingContextView = Schema.Struct({
  isSignedIn: Schema.Boolean,
  isStaff: Schema.Boolean.annotate({
    description: "Whether the StaffApi tools (the queue and the order lifecycle) are available.",
  }),
  customerId: Schema.optionalKey(
    CustomerId.annotate({
      description: "The signed-in customer: the key of their cart and of their order list.",
    }),
  ),
  displayName: Schema.optionalKey(Schema.String),
  shopId: ShopId.annotate({ description: "The shop: the key of the staff order queue." }),
  newIds: Schema.Struct({
    orderId: OrderId,
    cartItemId: CartItemId,
    checkoutId: CheckoutId,
  }),
}).annotate({ identifier: "OrderingContextView" });

export type AppError = typeof AppError.Type;

export type EmptyActionInput = typeof EmptyActionInput.Type;

export type OrderingContextView = typeof OrderingContextView.Type;
