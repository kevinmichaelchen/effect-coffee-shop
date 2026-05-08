import { index, integer, jsonb, pgSequence, pgTable, text } from "drizzle-orm/pg-core";
import type { Milk, Temperature } from "@effect-coffee-shop/coffee-core/domain/menu";
import { authSchema } from "./auth-schema.ts";

export const orderIdSequence = pgSequence("coffee_order_id_seq", {
  startWith: 1,
  increment: 1,
});

export const menuItemsTable = pgTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    sortOrder: integer("sort_order").notNull(),
    basePriceCents: integer("base_price_cents").notNull(),
    availableMilks: jsonb("available_milks").$type<ReadonlyArray<Milk>>().notNull(),
    availableTemperatures: jsonb("available_temperatures")
      .$type<ReadonlyArray<Temperature>>()
      .notNull(),
    maxShots: integer("max_shots").notNull(),
  },
  (table) => [index("menu_items_sort_order_idx").on(table.sortOrder, table.id)],
);

export const ordersTable = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    drinkId: text("drink_id").notNull(),
    drinkName: text("drink_name").notNull(),
    size: text("size").notNull(),
    milk: text("milk").notNull(),
    temperature: text("temperature").notNull(),
    shots: integer("shots").notNull(),
    notes: text("notes"),
    status: text("status").notNull(),
    priceCents: integer("price_cents").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("orders_created_at_idx").on(table.createdAt, table.id),
    index("orders_status_created_at_idx").on(table.status, table.createdAt, table.id),
    index("orders_owner_user_id_created_at_idx").on(table.ownerUserId, table.createdAt, table.id),
    index("orders_owner_user_id_status_created_at_idx").on(
      table.ownerUserId,
      table.status,
      table.createdAt,
      table.id,
    ),
  ],
);

export const coffeeSchema = {
  menuItemsTable,
  orderIdSequence,
  ordersTable,
};

export const schema = {
  ...authSchema,
  ...coffeeSchema,
};
