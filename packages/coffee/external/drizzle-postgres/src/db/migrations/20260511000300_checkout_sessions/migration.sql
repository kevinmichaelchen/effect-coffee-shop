CREATE SEQUENCE "public"."coffee_checkout_session_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"status" text NOT NULL,
	"total_price_cents" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_session_items" (
	"session_id" text NOT NULL,
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
	CONSTRAINT "checkout_session_items_session_id_position_pk" PRIMARY KEY("session_id","position")
);
--> statement-breakpoint
ALTER TABLE "checkout_session_items" ADD CONSTRAINT "checkout_session_items_session_id_checkout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."checkout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkout_sessions_owner_status_updated_idx" ON "checkout_sessions" USING btree ("owner_user_id","status","updated_at","id");
