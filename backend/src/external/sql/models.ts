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
  basepricecents: Schema.Int,
  availablemilks: Model.JsonFromString(Schema.Array(MilkSchema)),
  availabletemperatures: Model.JsonFromString(Schema.Array(TemperatureSchema)),
  maxshots: Schema.Int,
}) {}

export class SqlOrderModel extends Model.Class<SqlOrderModel>("SqlOrderModel")({
  id: OrderIdSchema,
  customername: Schema.String,
  owneruserid: Schema.String,
  drinkid: DrinkIdSchema,
  drinkname: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: Schema.optionalKey(Schema.NullOr(Schema.String)),
  status: OrderStatusSchema,
  pricecents: Schema.Int,
  createdat: Schema.DateTimeUtcFromString,
}) {}

type SqlOrder = typeof SqlOrderModel.Type;

export interface SqlOrderSave {
  readonly id: string;
  readonly customername: string;
  readonly owneruserid: string;
  readonly drinkid: string;
  readonly drinkname: string;
  readonly size: string;
  readonly milk: string;
  readonly temperature: string;
  readonly shots: number;
  readonly notes: string | null;
  readonly status: string;
  readonly pricecents: number;
  readonly createdat: string;
}

export interface SqlMenuItemSeed {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly sortorder: number;
  readonly basepricecents: number;
  readonly availablemilks: string;
  readonly availabletemperatures: string;
  readonly maxshots: number;
}

export const toSqlOrderSave = (order: CoffeeOrder): SqlOrderSave => ({
  id: order.id,
  customername: order.customerName,
  owneruserid: order.ownerUserId,
  drinkid: order.drinkId,
  drinkname: order.drinkName,
  size: order.size,
  milk: order.milk,
  temperature: order.temperature,
  shots: order.shots,
  notes: order.notes ?? null,
  status: order.status,
  pricecents: order.priceCents,
  createdat: Schema.encodeSync(Schema.DateTimeUtcFromString)(order.createdAt),
});

export const toCoffeeOrder = (order: SqlOrder): CoffeeOrder => ({
  id: order.id,
  customerName: order.customername,
  ownerUserId: order.owneruserid,
  drinkId: order.drinkid,
  drinkName: order.drinkname,
  size: order.size,
  milk: order.milk,
  temperature: order.temperature,
  shots: order.shots,
  status: order.status,
  priceCents: order.pricecents,
  createdAt: order.createdat,
  ...Option.match(Option.fromNullishOr(order.notes), {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});

export const toSqlMenuItemSeed = (item: MenuItem, sortOrder: number): SqlMenuItemSeed => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  sortorder: sortOrder,
  basepricecents: item.basePriceCents,
  availablemilks: JSON.stringify(item.availableMilks),
  availabletemperatures: JSON.stringify(item.availableTemperatures),
  maxshots: item.maxShots,
});
