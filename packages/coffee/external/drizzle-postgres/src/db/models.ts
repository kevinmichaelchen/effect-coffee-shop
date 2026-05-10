import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createSelectSchema } from "drizzle-orm/effect-schema";
import { CartItemIdSchema, type CartItem } from "@effect-coffee-shop/coffee-core/domain/cart";
import {
  DrinkIdSchema,
  DrinkKindSchema,
  DrinkSizeSchema,
  MilkSchema,
  TemperatureSchema,
  type MenuItem,
} from "@effect-coffee-shop/coffee-core/domain/menu";
import { moneyFromCents, moneyToCents } from "@effect-coffee-shop/coffee-core/domain/money";
import {
  OrderIdSchema,
  OrderStatusSchema,
  type CoffeeOrder,
  type CoffeeOrderItem,
} from "@effect-coffee-shop/coffee-core/domain/order";
import { cartItemsTable, menuItemsTable, orderItemsTable, ordersTable } from "./schema.ts";

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

export const OrderIdSequenceRowSchema = Schema.Struct({
  value: Schema.Int,
});

type DrizzleMenuItemRow = typeof DrizzleMenuItemRowSchema.Type;
type DrizzleOrderRow = typeof DrizzleOrderRowSchema.Type;
type DrizzleOrderItemRow = typeof DrizzleOrderItemRowSchema.Type;
type DrizzleCartItemRow = typeof DrizzleCartItemRowSchema.Type;

export const toMenuItem = (item: DrizzleMenuItemRow): MenuItem => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  basePrice: moneyFromCents(item.basePriceCents),
  availableMilks: item.availableMilks,
  availableTemperatures: item.availableTemperatures,
  maxShots: item.maxShots,
});

const toCoffeeOrderItem = (item: DrizzleOrderItemRow): CoffeeOrderItem => ({
  drinkId: item.drinkId,
  drinkName: item.drinkName,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  quantity: item.quantity,
  unitPrice: moneyFromCents(item.unitPriceCents),
  lineTotal: moneyFromCents(item.lineTotalCents),
  ...Option.match(Option.fromNullishOr(item.notes), {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});

export const toCoffeeOrder = (
  order: DrizzleOrderRow,
  items: readonly DrizzleOrderItemRow[],
): CoffeeOrder => ({
  id: order.id,
  customerName: order.customerName,
  ownerUserId: order.ownerUserId,
  items: items.map(toCoffeeOrderItem),
  status: order.status,
  totalPrice: moneyFromCents(order.totalPriceCents),
  createdAt: order.createdAt,
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
  drinkId: item.drinkId,
  drinkName: item.drinkName,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  notes: item.notes ?? null,
  quantity: item.quantity,
  unitPriceCents: moneyToCents(item.unitPrice),
  lineTotalCents: moneyToCents(item.lineTotal),
});

export const toCartItem = (item: DrizzleCartItemRow): CartItem => ({
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
  milk: item.milk ?? "none",
  temperature: item.temperature ?? "hot",
  shots: item.shots ?? 0,
  notes: item.notes ?? null,
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
