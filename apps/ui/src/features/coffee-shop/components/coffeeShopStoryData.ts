import {
  createOrderDraft,
  type CoffeeOrder,
  type MenuItem,
} from "#features/coffee-shop/lib/coffee.ts";

export const storyMenu: readonly [MenuItem, ...MenuItem[]] = [
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

export const storySelectedItem = storyMenu[0];

export const storyDraft = {
  ...createOrderDraft(storySelectedItem),
  notes: "Extra dry foam.",
  shots: 2,
};

// Fixed timestamps and explicit totals keep stories independent of the backend and clock.
export const storyOrder: CoffeeOrder = {
  id: "ticket-1042",
  customerName: "Morgan Rivera",
  ownerUserId: "customer-morgan",
  status: "pending",
  createdAt: "2026-06-15T14:30:00.000Z",
  totalPriceCents: 679,
  items: [
    {
      drinkId: "latte",
      drinkName: "Latte",
      size: "medium",
      milk: "oat",
      temperature: "hot",
      shots: 2,
      quantity: 1,
      unitPriceCents: 679,
      lineTotalCents: 679,
      notes: "Extra dry foam.",
    },
  ],
};

export const storyGroupOrder: CoffeeOrder = {
  ...storyOrder,
  id: "ticket-1043",
  customerName: "Alexandra Montgomery-Rivera and the morning study group",
  totalPriceCents: 1755,
  items: [
    {
      ...storyOrder.items[0],
      drinkId: "latte",
      drinkName: "Latte",
      size: "medium",
      milk: "oat",
      temperature: "hot",
      shots: 2,
      quantity: 2,
      unitPriceCents: 679,
      lineTotalCents: 1358,
    },
    {
      drinkId: "earl-grey",
      drinkName: "Earl Grey",
      size: "medium",
      milk: "none",
      temperature: "hot",
      shots: 0,
      quantity: 1,
      unitPriceCents: 397,
      lineTotalCents: 397,
    },
  ],
};

export const storyActiveOrders: readonly CoffeeOrder[] = [
  storyOrder,
  { ...storyGroupOrder, status: "brewing" },
  { ...storyOrder, id: "ticket-1044", customerName: "Sam Lee", status: "ready" },
];

export const storyHistoryOrders: readonly CoffeeOrder[] = [
  { ...storyOrder, id: "ticket-1039", status: "picked-up" },
  { ...storyGroupOrder, id: "ticket-1040", status: "cancelled" },
];
