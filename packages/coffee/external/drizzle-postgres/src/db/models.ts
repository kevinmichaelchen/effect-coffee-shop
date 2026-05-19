import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createSelectSchema } from "drizzle-orm/effect-schema";
import {
  CartItemIdSchema,
  CartItemSchema,
  type CartItem,
} from "@effect-coffee-shop/coffee-core/domain/cart";
import {
  CheckoutSessionIdSchema,
  CheckoutSessionSchema,
  CheckoutSessionStatusSchema,
  type CheckoutSession,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import {
  DrinkIdSchema,
  DrinkKindSchema,
  DrinkSizeSchema,
  MenuItemSchema,
  MilkSchema,
  TemperatureSchema,
  type MenuItem,
} from "@effect-coffee-shop/coffee-core/domain/menu";
import { MoneyFromCentsSchema, moneyToCents } from "@effect-coffee-shop/coffee-core/domain/money";
import {
  CoffeeOrderItemSchema,
  CoffeeOrderSchema,
  OrderIdSchema,
  OrderStatusSchema,
  type CoffeeOrder,
  type CoffeeOrderItem,
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

export const DrizzleMenuItemRowSchema = createSelectSchema(menuItemsTable, {
  id: DrinkIdSchema,
  kind: DrinkKindSchema,
  availableMilks: Schema.Array(MilkSchema),
  availableTemperatures: Schema.Array(TemperatureSchema),
});

export const DrizzleOrderRowSchema = createSelectSchema(ordersTable, {
  id: OrderIdSchema,
  status: OrderStatusSchema,
  createdAt: Schema.DateTimeUtcFromString,
});

export const DrizzleOrderItemRowSchema = createSelectSchema(orderItemsTable, {
  orderId: OrderIdSchema,
  drinkId: DrinkIdSchema,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
});

export const DrizzleCartItemRowSchema = createSelectSchema(cartItemsTable, {
  id: CartItemIdSchema,
  drinkId: DrinkIdSchema,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
});

export const DrizzleCheckoutSessionRowSchema = createSelectSchema(checkoutSessionsTable, {
  id: CheckoutSessionIdSchema,
  status: CheckoutSessionStatusSchema,
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
});

export const DrizzleCheckoutSessionItemRowSchema = createSelectSchema(checkoutSessionItemsTable, {
  sessionId: CheckoutSessionIdSchema,
  drinkId: DrinkIdSchema,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
});

export const OrderIdSequenceRowSchema = Schema.Struct({
  value: Schema.Int,
});

export const CheckoutSessionIdSequenceRowSchema = Schema.Struct({
  value: Schema.Int,
});

type DrizzleMenuItemRow = typeof DrizzleMenuItemRowSchema.Type;
type DrizzleOrderRow = typeof DrizzleOrderRowSchema.Type;
type DrizzleOrderItemRow = typeof DrizzleOrderItemRowSchema.Type;
type DrizzleCartItemRow = typeof DrizzleCartItemRowSchema.Type;
type DrizzleCheckoutSessionRow = typeof DrizzleCheckoutSessionRowSchema.Type;
type DrizzleCheckoutSessionItemRow = typeof DrizzleCheckoutSessionItemRowSchema.Type;

const decodeCartItem = Schema.decodeUnknownSync(CartItemSchema);
const decodeCoffeeOrderType = Schema.decodeUnknownSync(Schema.toType(CoffeeOrderSchema));
const decodeCoffeeOrderItem = Schema.decodeUnknownSync(CoffeeOrderItemSchema);
const decodeCheckoutSession = Schema.decodeUnknownSync(Schema.toType(CheckoutSessionSchema));
const decodeMenuItem = Schema.decodeUnknownSync(MenuItemSchema);
const decodeMoneyFromCents = Schema.decodeUnknownSync(MoneyFromCentsSchema);

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
