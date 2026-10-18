-- Prototype auth replacement: previous auth accounts and credentials are disposable.
drop table if exists "agentCapabilityGrant";
drop table if exists "approvalRequest";
drop table if exists "agent";
drop table if exists "agentHost";
drop table if exists "account";
drop table if exists "passkey";
drop table if exists "session";
drop table if exists "verification";
drop table if exists "user";
create table "coffee_auth_subjects" (
  "id" text not null,
  "active" integer not null,
  "security_revision" text not null,
  "display_name" text not null,
  unique ("id")
);
create table "coffee_auth_passkey_flows" (
  "module_id" text not null,
  "flow_id" text not null,
  "purpose" text not null,
  "snapshot" text not null,
  "request_binding_verifier" text not null,
  "request_binding_expires_at" integer not null,
  "issued_at" integer not null,
  "expires_at" integer not null,
  "application_snapshot" text,
  unique ("module_id", "flow_id")
);
create table "coffee_auth_identifiers" (
  "namespace" text not null,
  "value" text not null,
  "module_id" text,
  "credential_id" text,
  "subject_id" text not null,
  "revision" text not null,
  "verified_at" integer,
  "active" integer not null,
  unique ("namespace", "value")
);
create table "coffee_auth_credentials" (
  "credential_id" text not null,
  "subject_id" text not null,
  "revision" text not null,
  "active" integer not null,
  unique ("credential_id")
);
create table "coffee_auth_sessions" (
  "session_id" text not null,
  "subject_id" text not null,
  "digest" text not null,
  "security_revision" text not null,
  "issued_at" integer not null,
  "expires_at" integer not null,
  "absolute_expires_at" integer not null,
  "record" text not null,
  unique ("session_id"),
  unique ("digest")
);
create table "coffee_auth_pending" (
  "module_id" text not null,
  "kind" text not null,
  "digest" text not null,
  "version" text not null,
  "flow_id" text not null,
  "subject_id" text not null,
  "binding_digest" text not null,
  "snapshot" text not null,
  "expires_at" integer not null,
  "attempt_limit" integer not null,
  "failed_attempts" integer not null,
  "consumed" integer not null,
  unique ("digest")
);
create table "coffee_auth_passkeyCredentials" (
  "credential_id" text not null,
  "subject_id" text not null,
  "rp_id" text not null,
  "protocol_credential_id" text not null,
  "credential_key" text not null,
  "user_handle" text not null,
  "public_key" text not null,
  "algorithm" integer not null,
  "profile" text not null,
  "credential_revision" text not null,
  "active" integer not null,
  "primary_sign_in" integer not null,
  "enrollment_user_verified" integer not null,
  "backup_eligible" integer not null,
  "backup_state" integer not null,
  "counter" integer not null,
  "name" text not null,
  "created_at" integer not null,
  "last_used_at" integer,
  unique ("credential_id"),
  unique ("credential_key")
);
