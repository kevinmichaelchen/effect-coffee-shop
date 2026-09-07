/**
 * Maps SQLite rows to Coffee domain models and persistence payloads.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { CartItemId, CartItem } from "@effect-coffee-shop/coffee-core/domain/cart";
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

const SqlNullableStringOption = Schema.OptionFromNullishOr(Schema.String, {
  onNoneEncoding: null,
});

export const SqlMenuItemModel = Schema.Struct({
  id: DrinkId,
  name: Schema.String,
  kind: DrinkKind,
  basePrice: MoneyFromCents,
  availableMilks: Schema.fromJsonString(Schema.Array(Milk)),
  availableTemperatures: Schema.fromJsonString(Schema.Array(Temperature)),
  maxShots: Schema.Int,
}).pipe(
  Schema.encodeKeys({
    basePrice: "base_price_cents",
    availableMilks: "available_milks",
    availableTemperatures: "available_temperatures",
    maxShots: "max_shots",
  }),
);

export const SqlOrderModel = Schema.Struct({
  id: OrderId,
  customerName: Schema.String,
  ownerUserId: Schema.String,
  status: OrderStatus,
  totalPrice: MoneyFromCents,
  createdAt: Schema.DateTimeUtcFromString,
}).pipe(
  Schema.encodeKeys({
    customerName: "customer_name",
    ownerUserId: "owner_user_id",
    totalPrice: "total_price_cents",
    createdAt: "created_at",
  }),
);

export const SqlOrderItemModel = Schema.Struct({
  orderId: OrderId,
  position: Schema.Int,
  drinkId: DrinkId,
  drinkName: Schema.String,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
  shots: Schema.Int,
  notes: SqlNullableStringOption,
  quantity: Schema.Int,
  unitPrice: MoneyFromCents,
  lineTotal: MoneyFromCents,
}).pipe(
  Schema.encodeKeys({
    orderId: "order_id",
    drinkId: "drink_id",
    drinkName: "drink_name",
    unitPrice: "unit_price_cents",
    lineTotal: "line_total_cents",
  }),
);

export const SqlCartItemModel = Schema.Struct({
  ownerUserId: Schema.String,
  id: CartItemId,
  position: Schema.Int,
  drinkId: DrinkId,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
  shots: Schema.Int,
  notes: SqlNullableStringOption,
  quantity: Schema.Int,
}).pipe(
  Schema.encodeKeys({
    ownerUserId: "owner_user_id",
    drinkId: "drink_id",
  }),
);

type SqlOrder = typeof SqlOrderModel.Type;
type SqlOrderItem = typeof SqlOrderItemModel.Type;
type SqlCartItem = typeof SqlCartItemModel.Type;
type SqlMenuItem = typeof SqlMenuItemModel.Type;

const decodeCartItem = Schema.decodeUnknownEffect(CartItem);
const decodeCoffeeOrderType = Schema.decodeUnknownEffect(Schema.toType(CoffeeOrder));
const decodeCoffeeOrderItem = Schema.decodeUnknownEffect(CoffeeOrderItem);
const decodeMenuItem = Schema.decodeUnknownEffect(MenuItem);

export interface SqlOrderSave {
  readonly id: string;
  readonly customerName: string;
  readonly ownerUserId: string;
  readonly status: string;
  readonly totalPriceCents: number;
  readonly createdAt: string;
}

export interface SqlOrderItemSave {
  readonly orderId: string;
  readonly position: number;
  readonly drinkId: string;
  readonly drinkName: string;
  readonly size: string;
  readonly milk: string;
  readonly temperature: string;
  readonly shots: number;
  // oxlint-disable-next-line effect/prefer-option-over-null -- SQL encoding contract uses NULL; domain notes are already Option.
  readonly notes: string | null;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly lineTotalCents: number;
}

export interface SqlCartItemSave {
  readonly ownerUserId: string;
  readonly id: string;
  readonly position: number;
  readonly drinkId: string;
  readonly size: string;
  readonly milk: string;
  readonly temperature: string;
  readonly shots: number;
  // oxlint-disable-next-line effect/prefer-option-over-null -- SQL encoding contract uses NULL; domain notes are already Option.
  readonly notes: string | null;
  readonly quantity: number;
}

export interface SqlMenuItemSeed {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly sortOrder: number;
  readonly basePriceCents: number;
  readonly availableMilks: string;
  readonly availableTemperatures: string;
  readonly maxShots: number;
}

const encodeMilksJson = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Array(Milk)));
const encodeTemperaturesJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Array(Temperature)),
);

export const toSqlOrderSave = (order: CoffeeOrder): SqlOrderSave => ({
  id: order.id,
  customerName: order.customerName,
  ownerUserId: order.ownerUserId,
  status: order.status,
  totalPriceCents: moneyToCents(order.totalPrice),
  createdAt: Schema.encodeSync(Schema.DateTimeUtcFromString)(order.createdAt),
});

export const toSqlOrderItemSave = (
  orderId: string,
  item: CoffeeOrderItem,
  position: number,
): SqlOrderItemSave => ({
  orderId,
  position,
  ...toPersistedCoffeeOrderItemFields(item),
});

export const toSqlCartItemSave = (
  ownerUserId: string,
  item: CartItem,
  position: number,
): SqlCartItemSave => ({
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

export const toCartItem = (item: SqlCartItem): Effect.Effect<CartItem, Schema.SchemaError> =>
  decodeCartItem({
    id: item.id,
    drinkId: item.drinkId,
    size: item.size,
    milk: item.milk,
    temperature: item.temperature,
    shots: item.shots,
    quantity: item.quantity,
    ...Option.match(item.notes, {
      onNone: () => ({}),
      onSome: (notes) => ({ notes }),
    }),
  });

const toCoffeeOrderItem = (
  item: SqlOrderItem,
): Effect.Effect<CoffeeOrderItem, Schema.SchemaError> =>
  decodeCoffeeOrderItem({
    drinkId: item.drinkId,
    drinkName: item.drinkName,
    size: item.size,
    milk: item.milk,
    temperature: item.temperature,
    shots: item.shots,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    ...Option.match(item.notes, {
      onNone: () => ({}),
      onSome: (notes) => ({ notes }),
    }),
  });

export const toCoffeeOrder = Effect.fn("SqlModels.toCoffeeOrder")(function* (
  order: SqlOrder,
  items: readonly SqlOrderItem[],
) {
  const decodedItems = yield* Effect.forEach(items, toCoffeeOrderItem, { concurrency: 1 });
  return yield* decodeCoffeeOrderType({
    id: order.id,
    customerName: order.customerName,
    ownerUserId: order.ownerUserId,
    items: decodedItems,
    status: order.status,
    totalPrice: order.totalPrice,
    createdAt: order.createdAt,
  });
});

export const toMenuItem = (item: SqlMenuItem): Effect.Effect<MenuItem, Schema.SchemaError> =>
  decodeMenuItem({
    id: item.id,
    name: item.name,
    kind: item.kind,
    basePrice: item.basePrice,
    availableMilks: item.availableMilks,
    availableTemperatures: item.availableTemperatures,
    maxShots: item.maxShots,
  });

export const toSqlMenuItemSeed = (item: MenuItem, sortOrder: number): SqlMenuItemSeed => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  sortOrder,
  basePriceCents: moneyToCents(item.basePrice),
  availableMilks: encodeMilksJson(item.availableMilks),
  availableTemperatures: encodeTemperaturesJson(item.availableTemperatures),
  maxShots: item.maxShots,
});

export type SqlMenuItemModel = typeof SqlMenuItemModel.Type;

export type SqlOrderModel = typeof SqlOrderModel.Type;

export type SqlOrderItemModel = typeof SqlOrderItemModel.Type;

export type SqlCartItemModel = typeof SqlCartItemModel.Type;
