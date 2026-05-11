CREATE TABLE "pending_order_confirmations" (
	"owner_user_id" text PRIMARY KEY,
	"source" text NOT NULL,
	"total_price_cents" integer NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_order_confirmation_items" (
	"owner_user_id" text NOT NULL,
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
	CONSTRAINT "pending_order_confirmation_items_owner_position_pk" PRIMARY KEY("owner_user_id","position")
);
--> statement-breakpoint
ALTER TABLE "pending_order_confirmation_items" ADD CONSTRAINT "pending_order_confirmation_items_owner_user_id_pending_order_confirmations_owner_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."pending_order_confirmations"("owner_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_order_confirmation_items_owner_position_idx" ON "pending_order_confirmation_items" ("owner_user_id","position");
