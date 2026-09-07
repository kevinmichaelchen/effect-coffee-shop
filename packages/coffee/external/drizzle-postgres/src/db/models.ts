/**
 * Maps Postgres rows to Coffee domain models and persistence payloads.
 *
 * @module
 */
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createSelectSchema } from "drizzle-orm/effect-schema";
import { CartItemId, CartItem } from "@effect-coffee-shop/coffee-core/domain/cart";
import {
  CheckoutSessionId,
  CheckoutSession,
  CheckoutSessionStatus,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import {
  DrinkId,
  DrinkKind,
  DrinkSize,
  MenuItem,
  Milk,
  Temperature,
} from "@effect-coffee-shop/coffee-core/domain/menu";
import { MoneyFromCents, moneyToCents } from "@effect-coffee-shop/coffee-core/domain/money";
import {
  CoffeeOrderItem,
  CoffeeOrder,
  OrderId,
  OrderStatus,
} from "@effect-coffee-shop/coffee-core/domain/order";
import { toPersistedCoffeeOrderItemFields } from "@effect-coffee-shop/coffee-core/application/ports/coffee-order-item-persistence";
import {
  cartItemsTable,
  checkoutSessionItemsTable,
  checkoutSessionsTable,
  menuItemsTable,
  orderItemsTable,
  ordersTable,
} from "./schema.ts";

export const DrizzleMenuItemRow = createSelectSchema(menuItemsTable, {
  id: DrinkId,
  kind: DrinkKind,
  availableMilks: Schema.Array(Milk),
  availableTemperatures: Schema.Array(Temperature),
});

export const DrizzleOrderRow = createSelectSchema(ordersTable, {
  id: OrderId,
  status: OrderStatus,
  createdAt: Schema.DateTimeUtcFromString,
});

export const DrizzleOrderItemRow = createSelectSchema(orderItemsTable, {
  orderId: OrderId,
  drinkId: DrinkId,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
});

export const DrizzleCartItemRow = createSelectSchema(cartItemsTable, {
  id: CartItemId,
  drinkId: DrinkId,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
});

export const DrizzleCheckoutSessionRow = createSelectSchema(checkoutSessionsTable, {
  id: CheckoutSessionId,
  status: CheckoutSessionStatus,
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
});

export const DrizzleCheckoutSessionItemRow = createSelectSchema(checkoutSessionItemsTable, {
  sessionId: CheckoutSessionId,
  drinkId: DrinkId,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
});

type DrizzleMenuItemRow = typeof DrizzleMenuItemRow.Type;
type DrizzleOrderRow = typeof DrizzleOrderRow.Type;
type DrizzleOrderItemRow = typeof DrizzleOrderItemRow.Type;
type DrizzleCartItemRow = typeof DrizzleCartItemRow.Type;
type DrizzleCheckoutSessionRow = typeof DrizzleCheckoutSessionRow.Type;
type DrizzleCheckoutSessionItemRow = typeof DrizzleCheckoutSessionItemRow.Type;

const decodeCartItem = Schema.decodeUnknownSync(CartItem);
const decodeCoffeeOrderType = Schema.decodeUnknownSync(Schema.toType(CoffeeOrder));
const decodeCoffeeOrderItem = Schema.decodeUnknownSync(CoffeeOrderItem);
const decodeCheckoutSession = Schema.decodeUnknownSync(Schema.toType(CheckoutSession));
const decodeMenuItem = Schema.decodeUnknownSync(MenuItem);
const decodeMoneyFromCents = Schema.decodeUnknownSync(MoneyFromCents);

export const toMenuItem = (item: DrizzleMenuItemRow): MenuItem =>
  decodeMenuItem({
    id: item.id,
    name: item.name,
    kind: item.kind,
    basePrice: decodeMoneyFromCents(item.basePriceCents),
    availableMilks: item.availableMilks,
    availableTemperatures: item.availableTemperatures,
    maxShots: item.maxShots,
  });

const toCoffeeOrderItem = (item: DrizzleOrderItemRow): CoffeeOrderItem =>
  decodeCoffeeOrderItem({
    drinkId: item.drinkId,
    drinkName: item.drinkName,
    size: item.size,
    milk: item.milk,
    temperature: item.temperature,
    shots: item.shots,
    quantity: item.quantity,
    unitPrice: decodeMoneyFromCents(item.unitPriceCents),
    lineTotal: decodeMoneyFromCents(item.lineTotalCents),
    ...Option.match(Option.fromNullishOr(item.notes), {
      onNone: () => ({}),
      onSome: (notes) => ({ notes }),
    }),
  });

const toCheckoutSessionItem = (item: DrizzleCheckoutSessionItemRow): CoffeeOrderItem =>
  decodeCoffeeOrderItem({
    drinkId: item.drinkId,
    drinkName: item.drinkName,
    size: item.size,
    milk: item.milk,
    temperature: item.temperature,
    shots: item.shots,
    quantity: item.quantity,
    unitPrice: decodeMoneyFromCents(item.unitPriceCents),
    lineTotal: decodeMoneyFromCents(item.lineTotalCents),
    ...Option.match(Option.fromNullishOr(item.notes), {
      onNone: () => ({}),
      onSome: (notes) => ({ notes }),
    }),
  });

export const toCoffeeOrder = (
  order: DrizzleOrderRow,
  items: readonly DrizzleOrderItemRow[],
): CoffeeOrder =>
  decodeCoffeeOrderType({
    id: order.id,
    customerName: order.customerName,
    ownerUserId: order.ownerUserId,
    items: items.map(toCoffeeOrderItem),
    status: order.status,
    totalPrice: decodeMoneyFromCents(order.totalPriceCents),
    createdAt: order.createdAt,
  });

export const toCheckoutSession = (
  session: DrizzleCheckoutSessionRow,
  items: readonly DrizzleCheckoutSessionItemRow[],
): CheckoutSession =>
  decodeCheckoutSession({
    id: session.id,
    ownerUserId: session.ownerUserId,
    status: session.status,
    items: items.map(toCheckoutSessionItem),
    totalPrice: decodeMoneyFromCents(session.totalPriceCents),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  });

export const toOrderInsert = (order: CoffeeOrder): typeof ordersTable.$inferInsert => ({
  id: order.id,
  customerName: order.customerName,
  ownerUserId: order.ownerUserId,
  status: order.status,
  totalPriceCents: moneyToCents(order.totalPrice),
  createdAt: Schema.encodeSync(Schema.DateTimeUtcFromString)(order.createdAt),
});

export const toOrderItemInsert = (
  orderId: string,
  item: CoffeeOrderItem,
  position: number,
): typeof orderItemsTable.$inferInsert => ({
  orderId,
  position,
  ...toPersistedCoffeeOrderItemFields(item),
});

export const toCheckoutSessionInsert = (
  session: CheckoutSession,
): typeof checkoutSessionsTable.$inferInsert => ({
  id: session.id,
  ownerUserId: session.ownerUserId,
  status: session.status,
  totalPriceCents: moneyToCents(session.totalPrice),
  createdAt: Schema.encodeSync(Schema.DateTimeUtcFromString)(session.createdAt),
  updatedAt: Schema.encodeSync(Schema.DateTimeUtcFromString)(session.updatedAt),
  expiresAt: Schema.encodeSync(Schema.DateTimeUtcFromString)(session.expiresAt),
});

export const toCheckoutSessionItemInsert = (
  sessionId: string,
  item: CoffeeOrderItem,
  position: number,
): typeof checkoutSessionItemsTable.$inferInsert => ({
  sessionId,
  position,
  ...toPersistedCoffeeOrderItemFields(item),
});

export const toCartItem = (item: DrizzleCartItemRow): CartItem =>
  decodeCartItem({
    id: item.id,
    drinkId: item.drinkId,
    size: item.size,
    milk: item.milk,
    temperature: item.temperature,
    shots: item.shots,
    quantity: item.quantity,
    ...Option.match(Option.fromNullishOr(item.notes), {
      onNone: () => ({}),
      onSome: (notes) => ({ notes }),
    }),
  });

export const toCartItemInsert = (
  ownerUserId: string,
  item: CartItem,
  position: number,
): typeof cartItemsTable.$inferInsert => ({
  ownerUserId,
  id: item.id,
  position,
  drinkId: item.drinkId,
  size: item.size,
  milk: Option.getOrElse(item.milk, () => "none"),
  temperature: Option.getOrElse(item.temperature, () => "hot"),
  shots: Option.getOrElse(item.shots, () => 0),
  notes: Option.getOrNull(item.notes),
  quantity: item.quantity,
});

export const toMenuItemSeed = (
  item: MenuItem,
  sortOrder: number,
): typeof menuItemsTable.$inferInsert => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  sortOrder,
  basePriceCents: moneyToCents(item.basePrice),
  availableMilks: item.availableMilks,
  availableTemperatures: item.availableTemperatures,
  maxShots: item.maxShots,
});
