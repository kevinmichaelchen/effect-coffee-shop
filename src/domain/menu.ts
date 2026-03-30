import * as Schema from "effect/Schema"

export const drinkIds = ["espresso", "americano", "latte", "cappuccino", "cold-brew", "tea"] as const
export type DrinkId = (typeof drinkIds)[number]
export const DrinkIdSchema = Schema.Literals(drinkIds)

export const drinkKinds = ["espresso", "tea"] as const
export type DrinkKind = (typeof drinkKinds)[number]
export const DrinkKindSchema = Schema.Literals(drinkKinds)

export const drinkSizes = ["small", "medium", "large"] as const
export type DrinkSize = (typeof drinkSizes)[number]
export const DrinkSizeSchema = Schema.Literals(drinkSizes)

export const milks = ["whole", "oat", "almond", "none"] as const
export type Milk = (typeof milks)[number]
export const MilkSchema = Schema.Literals(milks)

export const temperatures = ["hot", "iced", "extra-hot"] as const
export type Temperature = (typeof temperatures)[number]
export const TemperatureSchema = Schema.Literals(temperatures)

export const MenuItemSchema = Schema.Struct({
  id: DrinkIdSchema,
  name: Schema.String,
  kind: DrinkKindSchema,
  basePriceCents: Schema.Int,
  availableMilks: Schema.Array(MilkSchema),
  availableTemperatures: Schema.Array(TemperatureSchema),
  maxShots: Schema.Int
}).annotate({ identifier: "MenuItem" })
export type MenuItem = typeof MenuItemSchema.Type

export const MenuSchema = Schema.Array(MenuItemSchema).annotate({ identifier: "Menu" })
export type Menu = typeof MenuSchema.Type

const matches = <T extends string>(choices: readonly T[], value: string): value is T =>
  choices.some((choice) => choice === value)

export const isDrinkId = (value: string): value is DrinkId => matches(drinkIds, value)
export const isDrinkSize = (value: string): value is DrinkSize => matches(drinkSizes, value)
export const isMilk = (value: string): value is Milk => matches(milks, value)
export const isTemperature = (value: string): value is Temperature => matches(temperatures, value)

export const menuItems = [
  {
    id: "espresso",
    name: "Espresso",
    kind: "espresso",
    basePriceCents: 300,
    availableMilks: ["none"],
    availableTemperatures: ["hot"],
    maxShots: 4
  },
  {
    id: "americano",
    name: "Americano",
    kind: "espresso",
    basePriceCents: 350,
    availableMilks: ["none"],
    availableTemperatures: ["hot", "iced"],
    maxShots: 4
  },
  {
    id: "latte",
    name: "Latte",
    kind: "espresso",
    basePriceCents: 450,
    availableMilks: ["whole", "oat", "almond", "none"],
    availableTemperatures: ["hot", "iced", "extra-hot"],
    maxShots: 4
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    kind: "espresso",
    basePriceCents: 425,
    availableMilks: ["whole", "oat", "almond", "none"],
    availableTemperatures: ["hot", "extra-hot"],
    maxShots: 4
  },
  {
    id: "cold-brew",
    name: "Cold Brew",
    kind: "espresso",
    basePriceCents: 400,
    availableMilks: ["whole", "oat", "almond", "none"],
    availableTemperatures: ["iced"],
    maxShots: 2
  },
  {
    id: "tea",
    name: "Tea",
    kind: "tea",
    basePriceCents: 325,
    availableMilks: ["none"],
    availableTemperatures: ["hot", "iced"],
    maxShots: 0
  }
] satisfies ReadonlyArray<MenuItem>

const sizeMultipliers: Record<DrinkSize, number> = {
  small: 1,
  medium: 1.15,
  large: 1.3
}

export const defaultMilkFor = (item: MenuItem): Milk =>
  item.availableMilks.some((milk) => milk === "whole") ? "whole" : item.availableMilks[0] ?? "none"

export const defaultTemperatureFor = (item: MenuItem): Temperature => item.availableTemperatures[0] ?? "hot"

export const defaultShotsFor = (item: MenuItem): number => item.kind === "tea" ? 0 : 1

export const calculatePriceCents = (item: MenuItem, size: DrinkSize, shots: number): number => {
  const scaledBase = Math.round(item.basePriceCents * sizeMultipliers[size])
  const includedShots = defaultShotsFor(item)
  const extraShots = Math.max(shots - includedShots, 0)
  return scaledBase + (extraShots * 75)
}

export const availableValues = (values: readonly string[]): string => values.join(", ")
