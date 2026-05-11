DELETE FROM "pending_order_confirmation_items";
--> statement-breakpoint
DELETE FROM "pending_order_confirmations";
--> statement-breakpoint
ALTER TABLE "pending_order_confirmations" ADD COLUMN "confirmation_id" text NOT NULL DEFAULT '00000000-0000-4000-8000-000000000000';
