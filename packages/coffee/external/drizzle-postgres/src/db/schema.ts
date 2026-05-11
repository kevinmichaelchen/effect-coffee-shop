import { index, integer, jsonb, pgSequence, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
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

export const pendingOrderConfirmationsTable = pgTable("pending_order_confirmations", {
  ownerUserId: text("owner_user_id").primaryKey(),
  source: text("source").notNull(),
  totalPriceCents: integer("total_price_cents").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pendingOrderConfirmationItemsTable = pgTable(
  "pending_order_confirmation_items",
  {
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => pendingOrderConfirmationsTable.ownerUserId, { onDelete: "cascade" }),
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
      name: "pending_order_confirmation_items_owner_position_pk",
      columns: [table.ownerUserId, table.position],
    }),
    index("pending_order_confirmation_items_owner_position_idx").on(
      table.ownerUserId,
      table.position,
    ),
  ],
);

export const coffeeSchema = {
  cartItemsTable,
  cartsTable,
  menuItemsTable,
  orderIdSequence,
  orderItemsTable,
  ordersTable,
  pendingOrderConfirmationItemsTable,
  pendingOrderConfirmationsTable,
};

export const schema = {
  ...authSchema,
  ...coffeeSchema,
};
