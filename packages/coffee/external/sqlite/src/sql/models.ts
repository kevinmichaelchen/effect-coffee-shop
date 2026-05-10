import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Model } from "effect/unstable/schema";
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
  status: OrderStatusSchema,
  total_price_cents: Schema.Int,
  created_at: Schema.DateTimeUtcFromString,
}) {}

export class SqlOrderItemModel extends Model.Class<SqlOrderItemModel>("SqlOrderItemModel")({
  order_id: OrderIdSchema,
  position: Schema.Int,
  drink_id: DrinkIdSchema,
  drink_name: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: Schema.optionalKey(Schema.NullOr(Schema.String)),
  quantity: Schema.Int,
  unit_price_cents: Schema.Int,
  line_total_cents: Schema.Int,
}) {}

export class SqlCartItemModel extends Model.Class<SqlCartItemModel>("SqlCartItemModel")({
  owner_user_id: Schema.String,
  id: CartItemIdSchema,
  position: Schema.Int,
  drink_id: DrinkIdSchema,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: Schema.optionalKey(Schema.NullOr(Schema.String)),
  quantity: Schema.Int,
}) {}

type SqlOrder = typeof SqlOrderModel.Type;
type SqlOrderItem = typeof SqlOrderItemModel.Type;
type SqlCartItem = typeof SqlCartItemModel.Type;

export interface SqlOrderSave {
  readonly id: string;
  readonly customer_name: string;
  readonly owner_user_id: string;
  readonly status: string;
  readonly total_price_cents: number;
  readonly created_at: string;
}

export interface SqlOrderItemSave {
  readonly order_id: string;
  readonly position: number;
  readonly drink_id: string;
  readonly drink_name: string;
  readonly size: string;
  readonly milk: string;
  readonly temperature: string;
  readonly shots: number;
  readonly notes: string | null;
  readonly quantity: number;
  readonly unit_price_cents: number;
  readonly line_total_cents: number;
}

export interface SqlCartItemSave {
  readonly owner_user_id: string;
  readonly id: string;
  readonly position: number;
  readonly drink_id: string;
  readonly size: string;
  readonly milk: string;
  readonly temperature: string;
  readonly shots: number;
  readonly notes: string | null;
  readonly quantity: number;
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
  status: order.status,
  total_price_cents: moneyToCents(order.totalPrice),
  created_at: Schema.encodeSync(Schema.DateTimeUtcFromString)(order.createdAt),
});

export const toSqlOrderItemSave = (
  orderId: string,
  item: CoffeeOrderItem,
  position: number,
): SqlOrderItemSave => ({
  order_id: orderId,
  position,
  drink_id: item.drinkId,
  drink_name: item.drinkName,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  notes: item.notes ?? null,
  quantity: item.quantity,
  unit_price_cents: moneyToCents(item.unitPrice),
  line_total_cents: moneyToCents(item.lineTotal),
});

export const toSqlCartItemSave = (
  ownerUserId: string,
  item: CartItem,
  position: number,
): SqlCartItemSave => ({
  owner_user_id: ownerUserId,
  id: item.id,
  position,
  drink_id: item.drinkId,
  size: item.size,
  milk: item.milk ?? "none",
  temperature: item.temperature ?? "hot",
  shots: item.shots ?? 0,
  notes: item.notes ?? null,
  quantity: item.quantity,
});

export const toCartItem = (item: SqlCartItem): CartItem => ({
  id: item.id,
  drinkId: item.drink_id,
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

const toCoffeeOrderItem = (item: SqlOrderItem): CoffeeOrderItem => ({
  drinkId: item.drink_id,
  drinkName: item.drink_name,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  quantity: item.quantity,
  unitPrice: moneyFromCents(item.unit_price_cents),
  lineTotal: moneyFromCents(item.line_total_cents),
  ...Option.match(Option.fromNullishOr(item.notes), {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});

export const toCoffeeOrder = (order: SqlOrder, items: readonly SqlOrderItem[]): CoffeeOrder => ({
  id: order.id,
  customerName: order.customer_name,
  ownerUserId: order.owner_user_id,
  items: items.map(toCoffeeOrderItem),
  status: order.status,
  totalPrice: moneyFromCents(order.total_price_cents),
  createdAt: order.created_at,
});

export const toMenuItem = (item: SqlMenuItemModel): MenuItem => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  basePrice: moneyFromCents(item.base_price_cents),
  availableMilks: item.available_milks,
  availableTemperatures: item.available_temperatures,
  maxShots: item.max_shots,
});

export const toSqlMenuItemSeed = (item: MenuItem, sortOrder: number): SqlMenuItemSeed => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  sort_order: sortOrder,
  base_price_cents: moneyToCents(item.basePrice),
  available_milks: JSON.stringify(item.availableMilks),
  available_temperatures: JSON.stringify(item.availableTemperatures),
  max_shots: item.maxShots,
});
