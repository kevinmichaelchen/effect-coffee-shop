/**
 * Defines boundary schemas and view models for Coffee application use cases.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { CartItemId } from "../domain/cart.ts";
import {
  CheckoutSessionId,
  CheckoutSessionStatus,
  type CheckoutSession,
} from "../domain/checkout-session.ts";
import { DrinkId, DrinkKind, DrinkSize, MenuItem, Milk, Temperature } from "../domain/menu.ts";
import { MoneyFromCents, Money } from "../domain/money.ts";
import { QuantityInput, ShotCountInput } from "../domain/order-primitives.ts";
import { CoffeeOrderItem, OrderId, OrderStatus, type CoffeeOrder } from "../domain/order.ts";

// Keep menu-choice request fields as trimmed strings so use cases can surface
// domain-specific errors instead of boundary SchemaError failures.
const BoundaryString = Schema.Trim;
const CartItemIdInput = CartItemId.annotate({
  description: "Cart line id, such as cart_item_00000000000000000000000001.",
});
const CheckoutSessionIdInput = CheckoutSessionId.annotate({
  description: "Checkout session id returned by prepare_cart_checkout.",
});
const CustomerNameInput = BoundaryString.annotate({
  description: "Optional customer display name for system or staff checkout.",
});
const DrinkIdInput = BoundaryString.annotate({
  description: "Menu drink id such as latte.",
});
const MilkInput = BoundaryString.annotate({
  description: "Milk choice such as whole, oat, almond, or none.",
});
const NotesInput = BoundaryString.annotate({
  description: "Optional item note.",
});
const OrderStatusInput = BoundaryString.annotate({
  description: "Optional order status filter such as pending, brewing, ready, or picked-up.",
});
const QuantityInputField = QuantityInput.annotate({
  description: "Positive line quantity.",
});
const ShotCountInputField = ShotCountInput.annotate({
  description: "Number of espresso shots.",
});
const SizeInput = BoundaryString.annotate({
  description: "Drink size such as small, medium, or large.",
});
const TemperatureInput = BoundaryString.annotate({
  description: "Drink temperature such as hot or iced.",
});

export const OrderItemInput = Schema.Struct({
  drinkId: DrinkIdInput,
  size: SizeInput,
  milk: Schema.optionalKey(MilkInput),
  temperature: Schema.optionalKey(TemperatureInput),
  shots: Schema.optionalKey(ShotCountInputField),
  notes: Schema.optionalKey(NotesInput),
  quantity: Schema.optionalKey(QuantityInputField),
}).annotate({ identifier: "OrderItemInput" });
export type OrderItemInput = typeof OrderItemInput.Type;

export const OrderItemsInput = Schema.NonEmptyArray(OrderItemInput).annotate({
  identifier: "OrderItemsInput",
});
export type OrderItemsInput = typeof OrderItemsInput.Type;

export const PlaceOrderRequest = Schema.Struct({
  customerName: Schema.optionalKey(CustomerNameInput),
  items: OrderItemsInput,
}).annotate({ identifier: "PlaceOrderRequest" });
export type PlaceOrderRequest = typeof PlaceOrderRequest.Type;

export const QuoteOrderRequest = Schema.Struct({
  items: OrderItemsInput,
}).annotate({ identifier: "QuoteOrderRequest" });
export type QuoteOrderRequest = typeof QuoteOrderRequest.Type;

export const ItemOptionsRequest = Schema.Struct({
  drinkId: DrinkIdInput,
}).annotate({ identifier: "ItemOptionsRequest" });
export type ItemOptionsRequest = typeof ItemOptionsRequest.Type;

export const UpdateCartItemRequest = Schema.Struct({
  cartItemId: CartItemIdInput,
  drinkId: Schema.optionalKey(DrinkIdInput),
  size: Schema.optionalKey(SizeInput),
  milk: Schema.optionalKey(MilkInput),
  temperature: Schema.optionalKey(TemperatureInput),
  shots: Schema.optionalKey(ShotCountInputField),
  notes: Schema.optionalKey(NotesInput),
  quantity: Schema.optionalKey(QuantityInputField),
}).annotate({ identifier: "UpdateCartItemRequest" });
export type UpdateCartItemRequest = typeof UpdateCartItemRequest.Type;

export const CartItemIdRequest = Schema.Struct({
  cartItemId: CartItemIdInput,
}).annotate({ identifier: "CartItemIdRequest" });
export type CartItemIdRequest = typeof CartItemIdRequest.Type;

export const CheckoutCartRequest = Schema.Struct({
  checkoutSessionId: CheckoutSessionIdInput,
  customerName: Schema.optionalKey(CustomerNameInput),
}).annotate({ identifier: "CheckoutCartRequest" });
export type CheckoutCartRequest = typeof CheckoutCartRequest.Type;

export const CheckoutSessionIdRequest = Schema.Struct({
  checkoutSessionId: CheckoutSessionIdInput,
}).annotate({ identifier: "CheckoutSessionIdRequest" });
export type CheckoutSessionIdRequest = typeof CheckoutSessionIdRequest.Type;

export const ListOrdersRequest = Schema.Struct({
  status: Schema.optionalKey(OrderStatusInput),
}).annotate({ identifier: "ListOrdersRequest" });
export type ListOrdersRequest = typeof ListOrdersRequest.Type;

export const OrderQuote = Schema.Struct({
  items: Schema.NonEmptyArray(CoffeeOrderItem),
  totalPrice: Money,
}).annotate({ identifier: "OrderQuote" });
export type OrderQuote = typeof OrderQuote.Type;

export const CartItemQuote = Schema.Struct({
  cartItemId: CartItemId,
  item: CoffeeOrderItem,
}).annotate({ identifier: "CartItemQuote" });
export type CartItemQuote = typeof CartItemQuote.Type;

export const CartSnapshot = Schema.Struct({
  ownerUserId: Schema.String,
  items: Schema.Array(CartItemQuote),
  totalPrice: Money,
}).annotate({ identifier: "CartSnapshot" });
export type CartSnapshot = typeof CartSnapshot.Type;

export const ItemOptions = Schema.Struct({
  item: MenuItem,
  availableSizes: Schema.Array(DrinkSize),
  defaultSize: DrinkSize,
  defaultMilk: Milk,
  defaultTemperature: Temperature,
  defaultShots: ShotCountInput,
  defaultQuantity: QuantityInput,
}).annotate({ identifier: "ItemOptions" });
export type ItemOptions = typeof ItemOptions.Type;

export const MenuItemView = Schema.Struct({
  id: DrinkId,
  name: Schema.String,
  kind: DrinkKind,
  basePriceCents: Schema.Int,
  availableMilks: Schema.Array(Milk),
  availableTemperatures: Schema.Array(Temperature),
  maxShots: ShotCountInput,
}).annotate({ identifier: "MenuItemView" });
export type MenuItemView = typeof MenuItemView.Type;

export const MenuView = Schema.Array(MenuItemView).annotate({
  identifier: "MenuView",
});
export type MenuView = typeof MenuView.Type;

export const CoffeeOrderItemView = Schema.Struct({
  drinkId: DrinkId,
  drinkName: Schema.String,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
  shots: ShotCountInput,
  notes: Schema.optionalKey(Schema.String),
  quantity: QuantityInput,
  unitPriceCents: Schema.Int,
  lineTotalCents: Schema.Int,
}).annotate({ identifier: "CoffeeOrderItemView" });
export type CoffeeOrderItemView = typeof CoffeeOrderItemView.Type;

export const CoffeeOrderView = Schema.Struct({
  id: Schema.toEncoded(OrderId),
  customerName: Schema.String,
  ownerUserId: Schema.String,
  items: Schema.NonEmptyArray(CoffeeOrderItemView),
  status: OrderStatus,
  totalPriceCents: Schema.Int,
  createdAt: Schema.toEncoded(Schema.DateTimeUtcFromString),
}).annotate({ identifier: "CoffeeOrderView" });
export type CoffeeOrderView = typeof CoffeeOrderView.Type;

export const CoffeeOrdersView = Schema.Array(CoffeeOrderView).annotate({
  identifier: "CoffeeOrdersView",
});
export type CoffeeOrdersView = typeof CoffeeOrdersView.Type;

export const OrderQuoteView = Schema.Struct({
  items: Schema.NonEmptyArray(CoffeeOrderItemView),
  totalPriceCents: Schema.Int,
}).annotate({ identifier: "OrderQuoteView" });
export type OrderQuoteView = typeof OrderQuoteView.Type;

export const OrderValidationView = Schema.Struct({
  valid: Schema.Literal(true),
  items: Schema.NonEmptyArray(CoffeeOrderItemView),
  totalPriceCents: Schema.Int,
}).annotate({ identifier: "OrderValidationView" });
export type OrderValidationView = typeof OrderValidationView.Type;

export const CartItemView = Schema.Struct({
  cartItemId: Schema.toEncoded(CartItemId),
  item: CoffeeOrderItemView,
}).annotate({ identifier: "CartItemView" });
export type CartItemView = typeof CartItemView.Type;

export const CartView = Schema.Struct({
  ownerUserId: Schema.String,
  items: Schema.Array(CartItemView),
  totalPriceCents: Schema.Int,
}).annotate({ identifier: "CartView" });
export type CartView = typeof CartView.Type;

export const CheckoutSessionView = Schema.Struct({
  id: Schema.toEncoded(CheckoutSessionId),
  ownerUserId: Schema.String,
  status: CheckoutSessionStatus,
  items: Schema.NonEmptyArray(CoffeeOrderItemView),
  totalPriceCents: Schema.Int,
  createdAt: Schema.toEncoded(Schema.DateTimeUtcFromString),
  updatedAt: Schema.toEncoded(Schema.DateTimeUtcFromString),
  expiresAt: Schema.toEncoded(Schema.DateTimeUtcFromString),
}).annotate({ identifier: "CheckoutSessionView" });
export type CheckoutSessionView = typeof CheckoutSessionView.Type;

export const NoCheckoutSessionView = Schema.Struct({
  status: Schema.Literal("no_checkout_session"),
}).annotate({ identifier: "NoCheckoutSessionView" });
export type NoCheckoutSessionView = typeof NoCheckoutSessionView.Type;

export const CheckoutSessionLookupView = Schema.Union([
  CheckoutSessionView,
  NoCheckoutSessionView,
]).annotate({ identifier: "CheckoutSessionLookupView" });
export type CheckoutSessionLookupView = typeof CheckoutSessionLookupView.Type;

export const ItemOptionsView = Schema.Struct({
  item: MenuItemView,
  availableSizes: Schema.Array(DrinkSize),
  defaultSize: DrinkSize,
  defaultMilk: Milk,
  defaultTemperature: Temperature,
  defaultShots: ShotCountInput,
  defaultQuantity: QuantityInput,
}).annotate({ identifier: "ItemOptionsView" });
export type ItemOptionsView = typeof ItemOptionsView.Type;

const OptionalViewString = Schema.optionalKey(Schema.String).pipe(
  Schema.decodeTo(Schema.Option(Schema.String), SchemaTransformation.optionFromOptionalKey()),
);

const MenuItemViewModel = Schema.Struct({
  id: DrinkId,
  name: Schema.String,
  kind: DrinkKind,
  basePrice: MoneyFromCents,
  availableMilks: Schema.Array(Milk),
  availableTemperatures: Schema.Array(Temperature),
  maxShots: ShotCountInput,
}).pipe(
  Schema.encodeKeys({
    basePrice: "basePriceCents",
  }),
);

const CoffeeOrderItemViewModel = Schema.Struct({
  drinkId: DrinkId,
  drinkName: Schema.String,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
  shots: ShotCountInput,
  notes: OptionalViewString,
  quantity: QuantityInput,
  unitPrice: MoneyFromCents,
  lineTotal: MoneyFromCents,
}).pipe(
  Schema.encodeKeys({
    unitPrice: "unitPriceCents",
    lineTotal: "lineTotalCents",
  }),
);

const CoffeeOrderViewModel = Schema.Struct({
  id: OrderId,
  customerName: Schema.String,
  ownerUserId: Schema.String,
  items: Schema.NonEmptyArray(CoffeeOrderItemViewModel),
  status: OrderStatus,
  totalPrice: MoneyFromCents,
  createdAt: Schema.DateTimeUtcFromString,
}).pipe(
  Schema.encodeKeys({
    totalPrice: "totalPriceCents",
  }),
);

const OrderQuoteViewModel = Schema.Struct({
  items: Schema.NonEmptyArray(CoffeeOrderItemViewModel),
  totalPrice: MoneyFromCents,
}).pipe(
  Schema.encodeKeys({
    totalPrice: "totalPriceCents",
  }),
);

const OrderValidationViewModel = Schema.Struct({
  valid: Schema.Literal(true),
  items: Schema.NonEmptyArray(CoffeeOrderItemViewModel),
  totalPrice: MoneyFromCents,
}).pipe(
  Schema.encodeKeys({
    totalPrice: "totalPriceCents",
  }),
);

const CartItemViewModel = Schema.Struct({
  cartItemId: CartItemId,
  item: CoffeeOrderItemViewModel,
});

const CartViewModel = Schema.Struct({
  ownerUserId: Schema.String,
  items: Schema.Array(CartItemViewModel),
  totalPrice: MoneyFromCents,
}).pipe(
  Schema.encodeKeys({
    totalPrice: "totalPriceCents",
  }),
);

const CheckoutSessionViewModel = Schema.Struct({
  id: CheckoutSessionId,
  ownerUserId: Schema.String,
  status: CheckoutSessionStatus,
  items: Schema.NonEmptyArray(CoffeeOrderItemViewModel),
  totalPrice: MoneyFromCents,
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
}).pipe(
  Schema.encodeKeys({
    totalPrice: "totalPriceCents",
  }),
);

const ItemOptionsViewModel = Schema.Struct({
  item: MenuItemViewModel,
  availableSizes: Schema.Array(DrinkSize),
  defaultSize: DrinkSize,
  defaultMilk: Milk,
  defaultTemperature: Temperature,
  defaultShots: ShotCountInput,
  defaultQuantity: QuantityInput,
});

const encodeMenuItemView = Schema.encodeSync(MenuItemViewModel);
const encodeCoffeeOrderItemView = Schema.encodeSync(CoffeeOrderItemViewModel);
const encodeCoffeeOrderView = Schema.encodeSync(CoffeeOrderViewModel);
const encodeOrderQuoteView = Schema.encodeSync(OrderQuoteViewModel);
const encodeOrderValidationView = Schema.encodeSync(OrderValidationViewModel);
const encodeCartView = Schema.encodeSync(CartViewModel);
const encodeCheckoutSessionView = Schema.encodeSync(CheckoutSessionViewModel);
const encodeItemOptionsView = Schema.encodeSync(ItemOptionsViewModel);

export const toMenuItemView = (item: MenuItem): MenuItemView => encodeMenuItemView(item);

export const toMenuView = (menu: readonly MenuItem[]): MenuView => Arr.map(menu, toMenuItemView);

export const toCoffeeOrderItemView = (item: CoffeeOrderItem): CoffeeOrderItemView =>
  encodeCoffeeOrderItemView(item);

export const toCoffeeOrderView = (order: CoffeeOrder): CoffeeOrderView =>
  encodeCoffeeOrderView(order);

export const toCoffeeOrdersView = (orders: readonly CoffeeOrder[]): CoffeeOrdersView =>
  Arr.map(orders, toCoffeeOrderView);

export const toOrderQuoteView = (quote: OrderQuote): OrderQuoteView => encodeOrderQuoteView(quote);

export const toOrderValidationView = (quote: OrderQuote): OrderValidationView =>
  encodeOrderValidationView({
    valid: true,
    items: quote.items,
    totalPrice: quote.totalPrice,
  });

export const toCartView = (cart: CartSnapshot): CartView =>
  encodeCartView({
    ownerUserId: cart.ownerUserId,
    items: Arr.map(cart.items, (cartItem) => ({
      cartItemId: cartItem.cartItemId,
      item: cartItem.item,
    })),
    totalPrice: cart.totalPrice,
  });

export const toCheckoutSessionView = (session: CheckoutSession): CheckoutSessionView =>
  encodeCheckoutSessionView(session);

export const toItemOptionsView = (options: ItemOptions): ItemOptionsView =>
  encodeItemOptionsView({
    item: options.item,
    availableSizes: options.availableSizes,
    defaultSize: options.defaultSize,
    defaultMilk: options.defaultMilk,
    defaultTemperature: options.defaultTemperature,
    defaultShots: options.defaultShots,
    defaultQuantity: options.defaultQuantity,
  });
