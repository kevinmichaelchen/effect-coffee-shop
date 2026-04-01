import { calculatePriceCents, createOrderDraft, getQueueLoad, type CoffeeOrder, type MenuItem } from "#features/coffee-shop/lib/coffee.ts";

export const storyMenu: readonly MenuItem[] = [
  {
    id: "latte",
    name: "Latte",
    kind: "espresso",
    basePriceCents: 525,
    availableMilks: ["whole", "oat", "almond"],
    availableTemperatures: ["hot", "iced", "extra-hot"],
    maxShots: 4,
  },
  {
    id: "americano",
    name: "Americano",
    kind: "espresso",
    basePriceCents: 395,
    availableMilks: ["none"],
    availableTemperatures: ["hot", "iced"],
    maxShots: 5,
  },
  {
    id: "earl-grey",
    name: "Earl Grey",
    kind: "tea",
    basePriceCents: 345,
    availableMilks: ["none", "oat"],
    availableTemperatures: ["hot", "iced"],
    maxShots: 0,
  },
];

export const storySelectedItem = storyMenu[0]!;

export const storyDraft = {
  ...createOrderDraft(storySelectedItem),
  customerName: "Maya",
  notes: "Extra dry foam.",
  shots: 2,
};

export const storyPriceCents = calculatePriceCents(storySelectedItem, storyDraft.size, storyDraft.shots);

export const storyOrders: readonly CoffeeOrder[] = [
  {
    id: "C-101",
    customerName: "Maya",
    drinkId: "latte",
    drinkName: "Latte",
    size: "medium",
    milk: "oat",
    temperature: "hot",
    shots: 2,
    notes: "Extra dry foam.",
    status: "pending",
    priceCents: 604,
    createdAt: "2026-03-31T13:05:00.000Z",
  },
  {
    id: "C-102",
    customerName: "Jordan",
    drinkId: "americano",
    drinkName: "Americano",
    size: "large",
    milk: "none",
    temperature: "iced",
    shots: 3,
    status: "brewing",
    priceCents: 589,
    createdAt: "2026-03-31T13:02:00.000Z",
  },
  {
    id: "C-103",
    customerName: "Avery",
    drinkId: "earl-grey",
    drinkName: "Earl Grey",
    size: "small",
    milk: "oat",
    temperature: "hot",
    shots: 0,
    status: "ready",
    priceCents: 345,
    createdAt: "2026-03-31T12:58:00.000Z",
  },
  {
    id: "C-099",
    customerName: "Riley",
    drinkId: "latte",
    drinkName: "Latte",
    size: "medium",
    milk: "whole",
    temperature: "hot",
    shots: 1,
    status: "picked-up",
    priceCents: 604,
    createdAt: "2026-03-31T12:42:00.000Z",
  },
];

export const storyActiveOrders = storyOrders.filter((order) =>
  ["pending", "brewing", "ready"].includes(order.status),
);

export const storyHistoryOrders = storyOrders.filter((order) =>
  ["picked-up", "cancelled"].includes(order.status),
);

export const storyQueueLoad = getQueueLoad(storyActiveOrders.length);
export const storySelectedOrder = storyActiveOrders[1] ?? null;
export const storyReceiptOrder = storyOrders[0] ?? null;
