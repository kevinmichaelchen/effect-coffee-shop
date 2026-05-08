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
} from "#domain/menu";
import { OrderIdSchema, OrderStatusSchema, type CoffeeOrder } from "#domain/order";

export class SqlMenuItemModel extends Model.Class<SqlMenuItemModel>("SqlMenuItemModel")({
  id: DrinkIdSchema,
  name: Schema.String,
  kind: DrinkKindSchema,
  base_price_cents: Schema.Int,
  available_milks: Model.JsonFromString(Schema.Array(MilkSchema)),
  available_temperatures: Model.JsonFromString(Schema.Array(TemperatureSchema)),
  max_shots: Schema.Int,
}) {}

export class SqlOrderModel extends Model.Class<SqlOrderModel>("SqlOrderModel")({
  id: OrderIdSchema,
  customer_name: Schema.String,
  owner_user_id: Schema.String,
  drink_id: DrinkIdSchema,
  drink_name: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: Schema.optionalKey(Schema.NullOr(Schema.String)),
  status: OrderStatusSchema,
  price_cents: Schema.Int,
  created_at: Schema.DateTimeUtcFromString,
}) {}

type SqlOrder = typeof SqlOrderModel.Type;

export interface SqlOrderSave {
  readonly id: string;
  readonly customer_name: string;
  readonly owner_user_id: string;
  readonly drink_id: string;
  readonly drink_name: string;
  readonly size: string;
  readonly milk: string;
  readonly temperature: string;
  readonly shots: number;
  readonly notes: string | null;
  readonly status: string;
  readonly price_cents: number;
  readonly created_at: string;
}

export interface SqlMenuItemSeed {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly sort_order: number;
  readonly base_price_cents: number;
  readonly available_milks: string;
  readonly available_temperatures: string;
  readonly max_shots: number;
}

export const toSqlOrderSave = (order: CoffeeOrder): SqlOrderSave => ({
  id: order.id,
  customer_name: order.customerName,
  owner_user_id: order.ownerUserId,
  drink_id: order.drinkId,
  drink_name: order.drinkName,
  size: order.size,
  milk: order.milk,
  temperature: order.temperature,
  shots: order.shots,
  notes: order.notes ?? null,
  status: order.status,
  price_cents: order.priceCents,
  created_at: Schema.encodeSync(Schema.DateTimeUtcFromString)(order.createdAt),
});

export const toCoffeeOrder = (order: SqlOrder): CoffeeOrder => ({
  id: order.id,
  customerName: order.customer_name,
  ownerUserId: order.owner_user_id,
  drinkId: order.drink_id,
  drinkName: order.drink_name,
  size: order.size,
  milk: order.milk,
  temperature: order.temperature,
  shots: order.shots,
  status: order.status,
  priceCents: order.price_cents,
  createdAt: order.created_at,
  ...Option.match(Option.fromNullishOr(order.notes), {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});

export const toSqlMenuItemSeed = (item: MenuItem, sortOrder: number): SqlMenuItemSeed => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  sort_order: sortOrder,
  base_price_cents: item.basePriceCents,
  available_milks: JSON.stringify(item.availableMilks),
  available_temperatures: JSON.stringify(item.availableTemperatures),
  max_shots: item.maxShots,
});
