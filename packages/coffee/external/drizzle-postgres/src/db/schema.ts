/**
 * Defines Drizzle tables and sequences for Coffee Postgres persistence.
 *
 * @module
 */
import { index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { Milk, Temperature } from "@effect-coffee-shop/coffee-core/domain/menu";
import { authSchema } from "./auth-schema.ts";

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
    status: text("status").notNull(),
    totalPriceCents: integer("total_price_cents").notNull(),
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

export const orderItemsTable = pgTable(
  "order_items",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    drinkId: text("drink_id").notNull(),
    drinkName: text("drink_name").notNull(),
    size: text("size").notNull(),
    milk: text("milk").notNull(),
    temperature: text("temperature").notNull(),
    shots: integer("shots").notNull(),
    notes: text("notes"),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (table) => [
    primaryKey({
      name: "order_items_order_id_position_pk",
      columns: [table.orderId, table.position],
    }),
  ],
);

export const cartsTable = pgTable("carts", {
  ownerUserId: text("owner_user_id").primaryKey(),
});

export const cartItemsTable = pgTable(
  "cart_items",
  {
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => cartsTable.ownerUserId, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    drinkId: text("drink_id").notNull(),
    size: text("size").notNull(),
    milk: text("milk").notNull(),
    temperature: text("temperature").notNull(),
    shots: integer("shots").notNull(),
    notes: text("notes"),
    quantity: integer("quantity").notNull(),
  },
  (table) => [index("cart_items_owner_user_id_position_idx").on(table.ownerUserId, table.position)],
);

export const checkoutSessionsTable = pgTable(
  "checkout_sessions",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    status: text("status").notNull(),
    totalPriceCents: integer("total_price_cents").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    index("checkout_sessions_owner_status_updated_idx").on(
      table.ownerUserId,
      table.status,
      table.updatedAt,
      table.id,
    ),
  ],
);

export const checkoutSessionItemsTable = pgTable(
  "checkout_session_items",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => checkoutSessionsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    drinkId: text("drink_id").notNull(),
    drinkName: text("drink_name").notNull(),
    size: text("size").notNull(),
    milk: text("milk").notNull(),
    temperature: text("temperature").notNull(),
    shots: integer("shots").notNull(),
    notes: text("notes"),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (table) => [
    primaryKey({
      name: "checkout_session_items_session_id_position_pk",
      columns: [table.sessionId, table.position],
    }),
  ],
);

export const coffeeSchema = {
  checkoutSessionItemsTable,
  checkoutSessionsTable,
  cartItemsTable,
  cartsTable,
  menuItemsTable,
  orderItemsTable,
  ordersTable,
};

export const schema = {
  ...authSchema,
  ...coffeeSchema,
};
