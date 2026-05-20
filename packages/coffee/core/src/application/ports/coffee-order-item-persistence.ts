import * as Option from "effect/Option";
import { moneyToCents } from "../../domain/money.ts";
import type { CoffeeOrderItem } from "../../domain/order.ts";

export interface PersistedCoffeeOrderItemFields {
  readonly drinkId: CoffeeOrderItem["drinkId"];
  readonly drinkName: CoffeeOrderItem["drinkName"];
  readonly size: CoffeeOrderItem["size"];
  readonly milk: CoffeeOrderItem["milk"];
  readonly temperature: CoffeeOrderItem["temperature"];
  readonly shots: CoffeeOrderItem["shots"];
  readonly notes: string | null;
  readonly quantity: CoffeeOrderItem["quantity"];
  readonly unitPriceCents: number;
  readonly lineTotalCents: number;
}

export const toPersistedCoffeeOrderItemFields = (
  item: CoffeeOrderItem,
): PersistedCoffeeOrderItemFields => ({
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
