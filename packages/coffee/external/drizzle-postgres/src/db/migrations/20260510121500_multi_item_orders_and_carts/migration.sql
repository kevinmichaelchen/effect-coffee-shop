ALTER TABLE "orders" RENAME TO "orders_legacy";--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY,
	"customer_name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"status" text NOT NULL,
	"total_price_cents" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"order_id" text NOT NULL,
	"position" integer NOT NULL,
	"drink_id" text NOT NULL,
	"drink_name" text NOT NULL,
	"size" text NOT NULL,
	"milk" text NOT NULL,
	"temperature" text NOT NULL,
	"shots" integer NOT NULL,
	"notes" text,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	CONSTRAINT "order_items_order_id_position_pk" PRIMARY KEY("order_id","position")
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"owner_user_id" text PRIMARY KEY
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"owner_user_id" text NOT NULL,
	"id" text PRIMARY KEY,
	"position" integer NOT NULL,
	"drink_id" text NOT NULL,
	"size" text NOT NULL,
	"milk" text NOT NULL,
	"temperature" text NOT NULL,
	"shots" integer NOT NULL,
	"notes" text,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
INSERT INTO "orders" ("id", "customer_name", "owner_user_id", "status", "total_price_cents", "created_at")
SELECT "id", "customer_name", "owner_user_id", "status", "price_cents", "created_at"
FROM "orders_legacy";--> statement-breakpoint
INSERT INTO "order_items" (
	"order_id",
	"position",
	"drink_id",
	"drink_name",
	"size",
	"milk",
	"temperature",
	"shots",
	"notes",
	"quantity",
	"unit_price_cents",
	"line_total_cents"
)
SELECT
	"id",
	0,
	"drink_id",
	"drink_name",
	"size",
	"milk",
	"temperature",
	"shots",
	"notes",
	1,
	"price_cents",
	"price_cents"
FROM "orders_legacy";--> statement-breakpoint
DROP TABLE "orders_legacy";--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_owner_user_id_carts_owner_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."carts"("owner_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at","id");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "orders_owner_user_id_created_at_idx" ON "orders" ("owner_user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "orders_owner_user_id_status_created_at_idx" ON "orders" ("owner_user_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "cart_items_owner_user_id_position_idx" ON "cart_items" ("owner_user_id","position");
