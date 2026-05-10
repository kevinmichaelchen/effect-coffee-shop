import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { CartItemIdSchema } from "../domain/cart.ts";
import {
  DrinkIdSchema,
  DrinkKindSchema,
  DrinkSizeSchema,
  MenuItemSchema,
  MilkSchema,
  TemperatureSchema,
  type MenuItem,
} from "../domain/menu.ts";
import { MoneySchema, moneyToCents } from "../domain/money.ts";
import { QuantityInputSchema, ShotCountInputSchema } from "../domain/order-primitives.ts";
import {
  CoffeeOrderItemSchema,
  OrderIdSchema,
  OrderStatusSchema,
  type CoffeeOrder,
  type CoffeeOrderItem,
} from "../domain/order.ts";

const BoundaryStringSchema = Schema.Trim;

export const OrderItemInputSchema = Schema.Struct({
  drinkId: BoundaryStringSchema,
  size: BoundaryStringSchema,
  milk: Schema.optionalKey(BoundaryStringSchema),
  temperature: Schema.optionalKey(BoundaryStringSchema),
  shots: Schema.optionalKey(ShotCountInputSchema),
  notes: Schema.optionalKey(BoundaryStringSchema),
  quantity: Schema.optionalKey(QuantityInputSchema),
}).annotate({ identifier: "OrderItemInput" });
export type OrderItemInput = typeof OrderItemInputSchema.Type;

export const OrderItemsInputSchema = Schema.NonEmptyArray(OrderItemInputSchema).annotate({
  identifier: "OrderItemsInput",
});
export type OrderItemsInput = typeof OrderItemsInputSchema.Type;

export const PlaceOrderRequestSchema = Schema.Struct({
  customerName: Schema.optionalKey(BoundaryStringSchema),
  items: OrderItemsInputSchema,
}).annotate({ identifier: "PlaceOrderRequest" });
export type PlaceOrderRequest = typeof PlaceOrderRequestSchema.Type;

export const QuoteOrderRequestSchema = Schema.Struct({
  items: OrderItemsInputSchema,
}).annotate({ identifier: "QuoteOrderRequest" });
export type QuoteOrderRequest = typeof QuoteOrderRequestSchema.Type;

export const ItemOptionsRequestSchema = Schema.Struct({
  drinkId: BoundaryStringSchema,
}).annotate({ identifier: "ItemOptionsRequest" });
export type ItemOptionsRequest = typeof ItemOptionsRequestSchema.Type;

export const UpdateCartItemRequestSchema = Schema.Struct({
  cartItemId: CartItemIdSchema,
  drinkId: Schema.optionalKey(BoundaryStringSchema),
  size: Schema.optionalKey(BoundaryStringSchema),
  milk: Schema.optionalKey(BoundaryStringSchema),
  temperature: Schema.optionalKey(BoundaryStringSchema),
  shots: Schema.optionalKey(ShotCountInputSchema),
  notes: Schema.optionalKey(BoundaryStringSchema),
  quantity: Schema.optionalKey(QuantityInputSchema),
}).annotate({ identifier: "UpdateCartItemRequest" });
export type UpdateCartItemRequest = typeof UpdateCartItemRequestSchema.Type;

export const CartItemIdRequestSchema = Schema.Struct({
  cartItemId: CartItemIdSchema,
}).annotate({ identifier: "CartItemIdRequest" });
export type CartItemIdRequest = typeof CartItemIdRequestSchema.Type;

export const CheckoutCartRequestSchema = Schema.Struct({
  customerName: Schema.optionalKey(BoundaryStringSchema),
}).annotate({ identifier: "CheckoutCartRequest" });
export type CheckoutCartRequest = typeof CheckoutCartRequestSchema.Type;

export const ListOrdersRequestSchema = Schema.Struct({
  status: Schema.optionalKey(BoundaryStringSchema),
}).annotate({ identifier: "ListOrdersRequest" });
export type ListOrdersRequest = typeof ListOrdersRequestSchema.Type;

export const OrderQuoteSchema = Schema.Struct({
  items: Schema.NonEmptyArray(CoffeeOrderItemSchema),
  totalPrice: MoneySchema,
}).annotate({ identifier: "OrderQuote" });
export type OrderQuote = typeof OrderQuoteSchema.Type;

export const CartItemQuoteSchema = Schema.Struct({
  cartItemId: CartItemIdSchema,
  item: CoffeeOrderItemSchema,
}).annotate({ identifier: "CartItemQuote" });
export type CartItemQuote = typeof CartItemQuoteSchema.Type;

export const CartSnapshotSchema = Schema.Struct({
  ownerUserId: Schema.String,
  items: Schema.Array(CartItemQuoteSchema),
  totalPrice: MoneySchema,
}).annotate({ identifier: "CartSnapshot" });
export type CartSnapshot = typeof CartSnapshotSchema.Type;

export const ItemOptionsSchema = Schema.Struct({
  item: MenuItemSchema,
  availableSizes: Schema.Array(DrinkSizeSchema),
  defaultSize: DrinkSizeSchema,
  defaultMilk: MilkSchema,
  defaultTemperature: TemperatureSchema,
  defaultShots: ShotCountInputSchema,
  defaultQuantity: QuantityInputSchema,
}).annotate({ identifier: "ItemOptions" });
export type ItemOptions = typeof ItemOptionsSchema.Type;

export const MenuItemViewSchema = Schema.Struct({
  id: DrinkIdSchema,
  name: Schema.String,
  kind: DrinkKindSchema,
  basePriceCents: Schema.Int,
  availableMilks: Schema.Array(MilkSchema),
  availableTemperatures: Schema.Array(TemperatureSchema),
  maxShots: ShotCountInputSchema,
}).annotate({ identifier: "MenuItemView" });
export type MenuItemView = typeof MenuItemViewSchema.Type;

export const MenuViewSchema = Schema.Array(MenuItemViewSchema).annotate({
  identifier: "MenuView",
});
export type MenuView = typeof MenuViewSchema.Type;

export const CoffeeOrderItemViewSchema = Schema.Struct({
  drinkId: DrinkIdSchema,
  drinkName: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: ShotCountInputSchema,
  notes: Schema.optionalKey(Schema.String),
  quantity: QuantityInputSchema,
  unitPriceCents: Schema.Int,
  lineTotalCents: Schema.Int,
}).annotate({ identifier: "CoffeeOrderItemView" });
export type CoffeeOrderItemView = typeof CoffeeOrderItemViewSchema.Type;

export const CoffeeOrderViewSchema = Schema.Struct({
  id: OrderIdSchema,
  customerName: Schema.String,
  ownerUserId: Schema.String,
  items: Schema.NonEmptyArray(CoffeeOrderItemViewSchema),
  status: OrderStatusSchema,
  totalPriceCents: Schema.Int,
  createdAt: Schema.DateTimeUtc,
}).annotate({ identifier: "CoffeeOrderView" });
export type CoffeeOrderView = typeof CoffeeOrderViewSchema.Type;

export const CoffeeOrdersViewSchema = Schema.Array(CoffeeOrderViewSchema).annotate({
  identifier: "CoffeeOrdersView",
});
export type CoffeeOrdersView = typeof CoffeeOrdersViewSchema.Type;

export const OrderQuoteViewSchema = Schema.Struct({
  items: Schema.NonEmptyArray(CoffeeOrderItemViewSchema),
  totalPriceCents: Schema.Int,
}).annotate({ identifier: "OrderQuoteView" });
export type OrderQuoteView = typeof OrderQuoteViewSchema.Type;

export const OrderValidationViewSchema = Schema.Struct({
  valid: Schema.Literal(true),
  items: Schema.NonEmptyArray(CoffeeOrderItemViewSchema),
  totalPriceCents: Schema.Int,
}).annotate({ identifier: "OrderValidationView" });
export type OrderValidationView = typeof OrderValidationViewSchema.Type;

export const CartItemViewSchema = Schema.Struct({
  cartItemId: CartItemIdSchema,
  item: CoffeeOrderItemViewSchema,
}).annotate({ identifier: "CartItemView" });
export type CartItemView = typeof CartItemViewSchema.Type;

export const CartViewSchema = Schema.Struct({
  ownerUserId: Schema.String,
  items: Schema.Array(CartItemViewSchema),
  totalPriceCents: Schema.Int,
}).annotate({ identifier: "CartView" });
export type CartView = typeof CartViewSchema.Type;

export const ItemOptionsViewSchema = Schema.Struct({
  item: MenuItemViewSchema,
  availableSizes: Schema.Array(DrinkSizeSchema),
  defaultSize: DrinkSizeSchema,
  defaultMilk: MilkSchema,
  defaultTemperature: TemperatureSchema,
  defaultShots: ShotCountInputSchema,
  defaultQuantity: QuantityInputSchema,
}).annotate({ identifier: "ItemOptionsView" });
export type ItemOptionsView = typeof ItemOptionsViewSchema.Type;

const mapNonEmpty = <A, B>(
  items: readonly [A, ...Array<A>],
  f: (item: A) => B,
): readonly [B, ...Array<B>] => {
  const [head, ...tail] = items;
  return [f(head), ...tail.map(f)];
};

export const toMenuItemView = (item: MenuItem): MenuItemView => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  basePriceCents: moneyToCents(item.basePrice),
  availableMilks: item.availableMilks,
  availableTemperatures: item.availableTemperatures,
  maxShots: item.maxShots,
});

export const toMenuView = (menu: readonly MenuItem[]): MenuView => menu.map(toMenuItemView);

export const toCoffeeOrderItemView = (item: CoffeeOrderItem): CoffeeOrderItemView => ({
  drinkId: item.drinkId,
  drinkName: item.drinkName,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  quantity: item.quantity,
  unitPriceCents: moneyToCents(item.unitPrice),
  lineTotalCents: moneyToCents(item.lineTotal),
  ...Option.match(Option.fromUndefinedOr(item.notes), {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});

export const toCoffeeOrderView = (order: CoffeeOrder): CoffeeOrderView => ({
  id: order.id,
  customerName: order.customerName,
  ownerUserId: order.ownerUserId,
  items: mapNonEmpty(order.items, toCoffeeOrderItemView),
  status: order.status,
  totalPriceCents: moneyToCents(order.totalPrice),
  createdAt: order.createdAt,
});

export const toCoffeeOrdersView = (orders: readonly CoffeeOrder[]): CoffeeOrdersView =>
  orders.map(toCoffeeOrderView);

export const toOrderQuoteView = (quote: OrderQuote): OrderQuoteView => ({
  items: mapNonEmpty(quote.items, toCoffeeOrderItemView),
  totalPriceCents: moneyToCents(quote.totalPrice),
});

export const toOrderValidationView = (quote: OrderQuote): OrderValidationView => ({
  valid: true,
  ...toOrderQuoteView(quote),
});

export const toCartView = (cart: CartSnapshot): CartView => ({
  ownerUserId: cart.ownerUserId,
  items: cart.items.map((cartItem) => ({
    cartItemId: cartItem.cartItemId,
    item: toCoffeeOrderItemView(cartItem.item),
  })),
  totalPriceCents: moneyToCents(cart.totalPrice),
});

export const toItemOptionsView = (options: ItemOptions): ItemOptionsView => ({
  item: toMenuItemView(options.item),
  availableSizes: options.availableSizes,
  defaultSize: options.defaultSize,
  defaultMilk: options.defaultMilk,
  defaultTemperature: options.defaultTemperature,
  defaultShots: options.defaultShots,
  defaultQuantity: options.defaultQuantity,
});
