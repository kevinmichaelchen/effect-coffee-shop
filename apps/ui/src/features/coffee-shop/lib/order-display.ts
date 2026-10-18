import type { OrderTicket } from "./coffee.ts";

export function getOrderTitle(order: OrderTicket): string {
  const firstItem = order.items[0];
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

  if (firstItem === undefined) {
    return "Empty ticket";
  }

  return itemCount > 1 ? `${firstItem.drinkName} + ${itemCount - 1}` : firstItem.drinkName;
}

export function formatOrderItems(order: OrderTicket): string {
  return order.items
    .map((item) => (item.quantity > 1 ? `${item.quantity}x ${item.drinkName}` : item.drinkName))
    .join(", ");
}
