CREATE SEQUENCE "public"."coffee_order_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"sort_order" integer NOT NULL,
	"base_price_cents" integer NOT NULL,
	"available_milks" jsonb NOT NULL,
	"available_temperatures" jsonb NOT NULL,
	"max_shots" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY,
	"customer_name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"drink_id" text NOT NULL,
	"drink_name" text NOT NULL,
	"size" text NOT NULL,
	"milk" text NOT NULL,
	"temperature" text NOT NULL,
	"shots" integer NOT NULL,
	"notes" text,
	"status" text NOT NULL,
	"price_cents" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentCapabilityGrant" (
	"id" text PRIMARY KEY,
	"agentId" text NOT NULL,
	"capability" text NOT NULL,
	"deniedBy" text,
	"grantedBy" text,
	"expiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"constraints" text
);
--> statement-breakpoint
CREATE TABLE "agentHost" (
	"id" text PRIMARY KEY,
	"name" text,
	"userId" text,
	"defaultCapabilities" text,
	"publicKey" text,
	"kid" text,
	"jwksUrl" text,
	"enrollmentTokenHash" text,
	"enrollmentTokenExpiresAt" timestamp with time zone,
	"status" text NOT NULL,
	"activatedAt" timestamp with time zone,
	"expiresAt" timestamp with time zone,
	"lastUsedAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"userId" text,
	"hostId" text NOT NULL,
	"status" text NOT NULL,
	"mode" text NOT NULL,
	"publicKey" text NOT NULL,
	"kid" text,
	"jwksUrl" text,
	"lastUsedAt" timestamp with time zone,
	"activatedAt" timestamp with time zone,
	"expiresAt" timestamp with time zone,
	"metadata" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvalRequest" (
	"id" text PRIMARY KEY,
	"method" text NOT NULL,
	"agentId" text,
	"hostId" text,
	"userId" text,
	"capabilities" text,
	"status" text NOT NULL,
	"userCodeHash" text,
	"loginHint" text,
	"bindingMessage" text,
	"clientNotificationToken" text,
	"clientNotificationEndpoint" text,
	"deliveryMode" text,
	"interval" integer NOT NULL,
	"lastPolledAt" timestamp with time zone,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY,
	"name" text,
	"publicKey" text NOT NULL,
	"userId" text NOT NULL,
	"credentialID" text NOT NULL,
	"counter" integer NOT NULL,
	"deviceType" text NOT NULL,
	"backedUp" boolean NOT NULL,
	"transports" text,
	"createdAt" timestamp with time zone,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL UNIQUE,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "menu_items_sort_order_idx" ON "menu_items" ("sort_order","id");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at","id");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "orders_owner_user_id_created_at_idx" ON "orders" ("owner_user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "orders_owner_user_id_status_created_at_idx" ON "orders" ("owner_user_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("userId");--> statement-breakpoint
CREATE INDEX "agentCapabilityGrant_agentId_idx" ON "agentCapabilityGrant" ("agentId");--> statement-breakpoint
CREATE INDEX "agentCapabilityGrant_capability_idx" ON "agentCapabilityGrant" ("capability");--> statement-breakpoint
CREATE INDEX "agentCapabilityGrant_grantedBy_idx" ON "agentCapabilityGrant" ("grantedBy");--> statement-breakpoint
CREATE INDEX "agentCapabilityGrant_status_idx" ON "agentCapabilityGrant" ("status");--> statement-breakpoint
CREATE INDEX "agentHost_userId_idx" ON "agentHost" ("userId");--> statement-breakpoint
CREATE INDEX "agentHost_kid_idx" ON "agentHost" ("kid");--> statement-breakpoint
CREATE INDEX "agentHost_enrollmentTokenHash_idx" ON "agentHost" ("enrollmentTokenHash");--> statement-breakpoint
CREATE INDEX "agentHost_status_idx" ON "agentHost" ("status");--> statement-breakpoint
CREATE INDEX "agent_userId_idx" ON "agent" ("userId");--> statement-breakpoint
CREATE INDEX "agent_hostId_idx" ON "agent" ("hostId");--> statement-breakpoint
CREATE INDEX "agent_status_idx" ON "agent" ("status");--> statement-breakpoint
CREATE INDEX "agent_kid_idx" ON "agent" ("kid");--> statement-breakpoint
CREATE INDEX "approvalRequest_agentId_idx" ON "approvalRequest" ("agentId");--> statement-breakpoint
CREATE INDEX "approvalRequest_hostId_idx" ON "approvalRequest" ("hostId");--> statement-breakpoint
CREATE INDEX "approvalRequest_userId_idx" ON "approvalRequest" ("userId");--> statement-breakpoint
CREATE INDEX "approvalRequest_status_idx" ON "approvalRequest" ("status");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" ("userId");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" ("credentialID");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("userId");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agentCapabilityGrant" ADD CONSTRAINT "agentCapabilityGrant_agentId_agent_id_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agentCapabilityGrant" ADD CONSTRAINT "agentCapabilityGrant_deniedBy_user_id_fkey" FOREIGN KEY ("deniedBy") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agentCapabilityGrant" ADD CONSTRAINT "agentCapabilityGrant_grantedBy_user_id_fkey" FOREIGN KEY ("grantedBy") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agentHost" ADD CONSTRAINT "agentHost_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_hostId_agentHost_id_fkey" FOREIGN KEY ("hostId") REFERENCES "agentHost"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approvalRequest" ADD CONSTRAINT "approvalRequest_agentId_agent_id_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approvalRequest" ADD CONSTRAINT "approvalRequest_hostId_agentHost_id_fkey" FOREIGN KEY ("hostId") REFERENCES "agentHost"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approvalRequest" ADD CONSTRAINT "approvalRequest_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;