import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  CartItemIdSchema,
  CartItemSchema,
  type CartItem,
} from "@effect-coffee-shop/coffee-core/domain/cart";
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

const SqlNullableStringOptionSchema = Schema.OptionFromNullishOr(Schema.String, {
  onNoneEncoding: null,
});

export const SqlMenuItemModel = Schema.Struct({
  id: DrinkIdSchema,
  name: Schema.String,
  kind: DrinkKindSchema,
  basePrice: MoneyFromCentsSchema,
  availableMilks: Schema.fromJsonString(Schema.Array(MilkSchema)),
  availableTemperatures: Schema.fromJsonString(Schema.Array(TemperatureSchema)),
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
  id: OrderIdSchema,
  customerName: Schema.String,
  ownerUserId: Schema.String,
  status: OrderStatusSchema,
  totalPrice: MoneyFromCentsSchema,
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
  orderId: OrderIdSchema,
  position: Schema.Int,
  drinkId: DrinkIdSchema,
  drinkName: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: SqlNullableStringOptionSchema,
  quantity: Schema.Int,
  unitPrice: MoneyFromCentsSchema,
  lineTotal: MoneyFromCentsSchema,
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
  id: CartItemIdSchema,
  position: Schema.Int,
  drinkId: DrinkIdSchema,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: SqlNullableStringOptionSchema,
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

const decodeCartItem = Schema.decodeUnknownSync(CartItemSchema);
const decodeCoffeeOrderType = Schema.decodeUnknownSync(Schema.toType(CoffeeOrderSchema));
const decodeCoffeeOrderItem = Schema.decodeUnknownSync(CoffeeOrderItemSchema);
const decodeMenuItem = Schema.decodeUnknownSync(MenuItemSchema);

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
  drinkId: item.drinkId,
  drinkName: item.drinkName,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  notes: Option.getOrNull(item.notes),
  quantity: item.quantity,
  unitPriceCents: moneyToCents(item.unitPrice),
  lineTotalCents: moneyToCents(item.lineTotal),
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

export const toCartItem = (item: SqlCartItem): CartItem =>
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

const toCoffeeOrderItem = (item: SqlOrderItem): CoffeeOrderItem =>
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

export const toCoffeeOrder = (order: SqlOrder, items: readonly SqlOrderItem[]): CoffeeOrder =>
  decodeCoffeeOrderType({
    id: order.id,
    customerName: order.customerName,
    ownerUserId: order.ownerUserId,
    items: items.map(toCoffeeOrderItem),
    status: order.status,
    totalPrice: order.totalPrice,
    createdAt: order.createdAt,
  });

export const toMenuItem = (item: SqlMenuItem): MenuItem =>
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
  availableMilks: JSON.stringify(item.availableMilks),
  availableTemperatures: JSON.stringify(item.availableTemperatures),
  maxShots: item.maxShots,
});
