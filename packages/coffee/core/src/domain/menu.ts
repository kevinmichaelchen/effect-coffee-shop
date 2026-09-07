/**
 * Defines the Coffee menu catalog, item options, and lookup helpers.
 *
 * @module
 */
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Money, moneyFromCents, scaleMoney, addMoney } from "./money.ts";
import { ShotCount } from "./order-primitives.ts";

export const drinkIds = [
  "espresso",
  "americano",
  "latte",
  "cappuccino",
  "cold-brew",
  "tea",
] as const;
export const DrinkId = Schema.Literals(drinkIds);

const drinkKinds = ["espresso", "tea"] as const;
export const DrinkKind = Schema.Literals(drinkKinds);

export const drinkSizes = ["small", "medium", "large"] as const;
export type DrinkSize = (typeof drinkSizes)[number];
export const DrinkSize = Schema.Literals(drinkSizes);

export const milks = ["whole", "oat", "almond", "none"] as const;
export type Milk = (typeof milks)[number];
export const Milk = Schema.Literals(milks);

export const temperatures = ["hot", "iced", "extra-hot"] as const;
export type Temperature = (typeof temperatures)[number];
export const Temperature = Schema.Literals(temperatures);

export const MenuItem = Schema.Struct({
  id: DrinkId,
  name: Schema.String,
  kind: DrinkKind,
  basePrice: Money,
  availableMilks: Schema.Array(Milk),
  availableTemperatures: Schema.Array(Temperature),
  maxShots: ShotCount,
}).annotate({ identifier: "MenuItem" });
export type MenuItem = typeof MenuItem.Type;

export const Menu = Schema.Array(MenuItem).annotate({ identifier: "Menu" });
export type Menu = typeof Menu.Type;

export const menuItems = Schema.decodeUnknownSync(Menu)([
  {
    id: "espresso",
    name: "Espresso",
    kind: "espresso",
    basePrice: moneyFromCents(300),
    availableMilks: ["none"],
    availableTemperatures: ["hot"],
    maxShots: 4,
  },
  {
    id: "americano",
    name: "Americano",
    kind: "espresso",
    basePrice: moneyFromCents(350),
    availableMilks: ["none"],
    availableTemperatures: ["hot", "iced"],
    maxShots: 4,
  },
  {
    id: "latte",
    name: "Latte",
    kind: "espresso",
    basePrice: moneyFromCents(450),
    availableMilks: ["whole", "oat", "almond", "none"],
    availableTemperatures: ["hot", "iced", "extra-hot"],
    maxShots: 4,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    kind: "espresso",
    basePrice: moneyFromCents(425),
    availableMilks: ["whole", "oat", "almond", "none"],
    availableTemperatures: ["hot", "extra-hot"],
    maxShots: 4,
  },
  {
    id: "cold-brew",
    name: "Cold Brew",
    kind: "espresso",
    basePrice: moneyFromCents(400),
    availableMilks: ["whole", "oat", "almond", "none"],
    availableTemperatures: ["iced"],
    maxShots: 2,
  },
  {
    id: "tea",
    name: "Tea",
    kind: "tea",
    basePrice: moneyFromCents(325),
    availableMilks: ["none"],
    availableTemperatures: ["hot", "iced"],
    maxShots: 0,
  },
]);

const shotCount = Schema.decodeUnknownSync(ShotCount);

const sizeMultipliers: Record<DrinkSize, number> = {
  small: 1,
  medium: 1.15,
  large: 1.3,
};

const defaultShotsByKind: Record<MenuItem["kind"], ShotCount> = {
  espresso: shotCount(1),
  tea: shotCount(0),
};

export const defaultMilkFor = (item: MenuItem): Milk =>
  Option.match(Option.fromUndefinedOr(item.availableMilks.find((milk) => milk === "whole")), {
    onNone: () => item.availableMilks[0] ?? "none",
    onSome: (milk) => milk,
  });

export const defaultTemperatureFor = (item: MenuItem): Temperature =>
  item.availableTemperatures[0] ?? "hot";

export const defaultShotsFor = (item: MenuItem): ShotCount => defaultShotsByKind[item.kind];

export const calculatePrice = (item: MenuItem, size: DrinkSize, shots: ShotCount): Money => {
  const scaledBase = scaleMoney(item.basePrice, sizeMultipliers[size]);
  const includedShots = defaultShotsFor(item);
  const extraShots = Math.max(shots - includedShots, 0);
  return addMoney(scaledBase, moneyFromCents(extraShots * 75));
};

export const availableValues = (values: readonly string[]): string => values.join(", ");

export type DrinkId = typeof DrinkId.Type;

export type DrinkKind = typeof DrinkKind.Type;
