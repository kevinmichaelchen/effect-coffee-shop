import * as Schema from "effect/Schema";
import { createSelectSchema } from "drizzle-orm/effect-schema";
import {
  DrinkIdSchema,
  DrinkKindSchema,
  DrinkSizeSchema,
  MilkSchema,
  TemperatureSchema,
  type MenuItem,
} from "@effect-coffee-shop/coffee-core/domain/menu";
import {
  OrderIdSchema,
  OrderStatusSchema,
  type CoffeeOrder,
} from "@effect-coffee-shop/coffee-core/domain/order";
import { menuItemsTable, ordersTable } from "./schema.ts";

export const DrizzleMenuItemRowSchema = createSelectSchema(menuItemsTable, {
  id: DrinkIdSchema,
  kind: DrinkKindSchema,
  availableMilks: Schema.Array(MilkSchema),
  availableTemperatures: Schema.Array(TemperatureSchema),
});

export const DrizzleOrderRowSchema = createSelectSchema(ordersTable, {
  id: OrderIdSchema,
  drinkId: DrinkIdSchema,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  status: OrderStatusSchema,
  createdAt: Schema.DateTimeUtcFromString,
});

export const OrderIdSequenceRowSchema = Schema.Struct({
  value: Schema.Int,
});

type DrizzleMenuItemRow = typeof DrizzleMenuItemRowSchema.Type;
type DrizzleOrderRow = typeof DrizzleOrderRowSchema.Type;

export const toMenuItem = (item: DrizzleMenuItemRow): MenuItem => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  basePriceCents: item.basePriceCents,
  availableMilks: item.availableMilks,
  availableTemperatures: item.availableTemperatures,
  maxShots: item.maxShots,
});

export const toCoffeeOrder = (order: DrizzleOrderRow): CoffeeOrder => ({
  id: order.id,
  customerName: order.customerName,
  ownerUserId: order.ownerUserId,
  drinkId: order.drinkId,
  drinkName: order.drinkName,
  size: order.size,
  milk: order.milk,
  temperature: order.temperature,
  shots: order.shots,
  status: order.status,
  priceCents: order.priceCents,
  createdAt: order.createdAt,
  ...(order.notes === null ? {} : { notes: order.notes }),
});

export const toOrderInsert = (order: CoffeeOrder): typeof ordersTable.$inferInsert => ({
  id: order.id,
  customerName: order.customerName,
  ownerUserId: order.ownerUserId,
  drinkId: order.drinkId,
  drinkName: order.drinkName,
  size: order.size,
  milk: order.milk,
  temperature: order.temperature,
  shots: order.shots,
  notes: order.notes ?? null,
  status: order.status,
  priceCents: order.priceCents,
  createdAt: Schema.encodeSync(Schema.DateTimeUtcFromString)(order.createdAt),
});

export const toMenuItemSeed = (
  item: MenuItem,
  sortOrder: number,
): typeof menuItemsTable.$inferInsert => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  sortOrder,
  basePriceCents: item.basePriceCents,
  availableMilks: item.availableMilks,
  availableTemperatures: item.availableTemperatures,
  maxShots: item.maxShots,
});
