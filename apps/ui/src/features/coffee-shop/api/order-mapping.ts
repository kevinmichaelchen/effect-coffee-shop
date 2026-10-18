import type { CoffeeOrder as DomainCoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import type { CoffeeOrderItem as DomainCoffeeOrderItem } from "@effect-coffee-shop/coffee-domain/Menu/OrderItem";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import type { OrderTicket } from "#features/coffee-shop/lib/coffee-schemas.ts";

type CoffeeOrderItem = OrderTicket["items"][number];

function toCoffeeOrderItem(item: DomainCoffeeOrderItem): CoffeeOrderItem {
  return {
    drinkId: item.drinkId,
    drinkName: item.drinkName,
    size: item.size,
    milk: item.milk,
    temperature: item.temperature,
    shots: item.shots,
    quantity: item.quantity,
    unitPriceCents: item.unitPrice.minorUnits,
    lineTotalCents: item.lineTotal.minorUnits,
    ...Option.match(item.notes, { onNone: () => ({}), onSome: (notes) => ({ notes }) }),
  };
}

/** The domain's order, in the cents-and-ISO-string shape the components render. */
export function toCoffeeOrder(order: DomainCoffeeOrder): OrderTicket {
  return {
    id: order.id,
    customerName: order.customerName,
    ownerUserId: order.ownerUserId,
    items: order.items.map(toCoffeeOrderItem),
    status: order.status,
    totalPriceCents: order.totalPrice.minorUnits,
    createdAt: DateTime.formatIso(order.createdAt),
  };
}

/** A view's order list (`null` when nothing was placed yet), mapped for the components. */
export function toCoffeeOrders(
  view: { readonly orders: ReadonlyArray<DomainCoffeeOrder> } | null,
): readonly OrderTicket[] {
  return view === null ? [] : view.orders.map(toCoffeeOrder);
}
