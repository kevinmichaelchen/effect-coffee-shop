-- Prototype auth replacement: previous auth accounts and credentials are disposable.
drop table if exists "agentCapabilityGrant";
--> statement-breakpoint
drop table if exists "approvalRequest";
--> statement-breakpoint
drop table if exists "agent";
--> statement-breakpoint
drop table if exists "agentHost";
--> statement-breakpoint
drop table if exists "account";
--> statement-breakpoint
drop table if exists "passkey";
--> statement-breakpoint
drop table if exists "session";
--> statement-breakpoint
drop table if exists "verification";
--> statement-breakpoint
drop table if exists "user";
--> statement-breakpoint
create table "coffee_auth_subjects" (
  "id" text not null,
  "active" boolean not null,
  "security_revision" text not null,
  "display_name" text not null,
  unique ("id")
);
--> statement-breakpoint
create table "coffee_auth_passkey_flows" (
  "module_id" text not null,
  "flow_id" text not null,
  "purpose" text not null,
  "snapshot" text not null,
  "request_binding_verifier" text not null,
  "request_binding_expires_at" bigint not null,
  "issued_at" bigint not null,
  "expires_at" bigint not null,
  "application_snapshot" text,
  unique ("module_id", "flow_id")
);
--> statement-breakpoint
create table "coffee_auth_identifiers" (
  "namespace" text not null,
  "value" text not null,
  "module_id" text,
  "credential_id" text,
  "subject_id" text not null,
  "revision" text not null,
  "verified_at" bigint,
  "active" boolean not null,
  unique ("namespace", "value")
);
--> statement-breakpoint
create table "coffee_auth_credentials" (
  "credential_id" text not null,
  "subject_id" text not null,
  "revision" text not null,
  "active" boolean not null,
  unique ("credential_id")
);
--> statement-breakpoint
create table "coffee_auth_sessions" (
  "session_id" text not null,
  "subject_id" text not null,
  "digest" text not null,
  "security_revision" text not null,
  "issued_at" bigint not null,
  "expires_at" bigint not null,
  "absolute_expires_at" bigint not null,
  "record" text not null,
  unique ("session_id"),
  unique ("digest")
);
--> statement-breakpoint
create table "coffee_auth_pending" (
  "module_id" text not null,
  "kind" text not null,
  "digest" text not null,
  "version" text not null,
  "flow_id" text not null,
  "subject_id" text not null,
  "binding_digest" text not null,
  "snapshot" text not null,
  "expires_at" bigint not null,
  "attempt_limit" bigint not null,
  "failed_attempts" bigint not null,
  "consumed" boolean not null,
  unique ("digest")
);
--> statement-breakpoint
create table "coffee_auth_passkeyCredentials" (
  "credential_id" text not null,
  "subject_id" text not null,
  "rp_id" text not null,
  "protocol_credential_id" text not null,
  "credential_key" text not null,
  "user_handle" text not null,
  "public_key" text not null,
  "algorithm" bigint not null,
  "profile" text not null,
  "credential_revision" text not null,
  "active" boolean not null,
  "primary_sign_in" boolean not null,
  "enrollment_user_verified" boolean not null,
  "backup_eligible" boolean not null,
  "backup_state" boolean not null,
  "counter" bigint not null,
  "name" text not null,
  "created_at" bigint not null,
  "last_used_at" bigint,
  unique ("credential_id"),
  unique ("credential_key")
);
