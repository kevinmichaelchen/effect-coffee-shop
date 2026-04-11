import { createOrderDraft, type MenuItem } from "#features/coffee-shop/lib/coffee.ts";

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
