import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Model } from "effect/unstable/schema";
import {
  DrinkIdSchema,
  DrinkKindSchema,
  DrinkSizeSchema,
  MilkSchema,
  TemperatureSchema,
  type MenuItem,
} from "../../domain/menu.ts";
import { OrderIdSchema, OrderStatusSchema, type CoffeeOrder } from "../../domain/order.ts";

export class SqlMenuItemModel extends Model.Class<SqlMenuItemModel>("SqlMenuItemModel")({
  id: DrinkIdSchema,
  name: Schema.String,
  kind: DrinkKindSchema,
  basePriceCents: Schema.Int,
  availableMilks: Model.JsonFromString(Schema.Array(MilkSchema)),
  availableTemperatures: Model.JsonFromString(Schema.Array(TemperatureSchema)),
  maxShots: Schema.Int,
}) {}

export type SqlMenuItem = typeof SqlMenuItemModel.Type;

export class SqlOrderModel extends Model.Class<SqlOrderModel>("SqlOrderModel")({
  id: OrderIdSchema,
  customerName: Schema.String,
  drinkId: DrinkIdSchema,
  drinkName: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: Model.FieldOption(Schema.String),
  status: OrderStatusSchema,
  priceCents: Schema.Int,
  createdAt: Schema.DateTimeUtcFromString,
}) {}

export type SqlOrder = typeof SqlOrderModel.Type;
export type SqlOrderInsert = typeof SqlOrderModel.insert.Type;

export const toSqlOrderInsert = (order: CoffeeOrder): SqlOrderInsert => ({
  ...order,
  notes: Option.fromUndefinedOr(order.notes),
});

export const toCoffeeOrder = (order: SqlOrder): CoffeeOrder => ({
  id: order.id,
  customerName: order.customerName,
  drinkId: order.drinkId,
  drinkName: order.drinkName,
  size: order.size,
  milk: order.milk,
  temperature: order.temperature,
  shots: order.shots,
  status: order.status,
  priceCents: order.priceCents,
  createdAt: order.createdAt,
  ...(Option.isSome(order.notes) ? { notes: order.notes.value } : {}),
});

export const toSqlMenuItemSeed = (
  item: MenuItem,
  sortOrder: number,
): Record<string, string | number> => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  sortOrder,
  basePriceCents: item.basePriceCents,
  availableMilks: JSON.stringify(item.availableMilks),
  availableTemperatures: JSON.stringify(item.availableTemperatures),
  maxShots: item.maxShots,
});
