/* SQL shape for the Yielded tables; auth owns their typed storage adapters. */
import { bigint, boolean, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

const subjects = pgTable(
  "coffee_auth_subjects",
  {
    id: text("id").notNull(),
    active: boolean("active").notNull(),
    securityRevision: text("security_revision").notNull(),
    displayName: text("display_name").notNull(),
  },
  (table) => [uniqueIndex("coffee_auth_subjects_key_0").on(table.id)],
);

const passkeyFlows = pgTable(
  "coffee_auth_passkey_flows",
  {
    moduleId: text("module_id").notNull(),
    flowId: text("flow_id").notNull(),
    purpose: text("purpose").notNull(),
    snapshot: text("snapshot").notNull(),
    requestBindingVerifier: text("request_binding_verifier").notNull(),
    requestBindingExpiresAt: bigint("request_binding_expires_at", { mode: "number" }).notNull(),
    issuedAt: bigint("issued_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    applicationSnapshot: text("application_snapshot"),
  },
  (table) => [uniqueIndex("coffee_auth_passkey_flows_key_0").on(table.moduleId, table.flowId)],
);

const identifiers = pgTable(
  "coffee_auth_identifiers",
  {
    namespace: text("namespace").notNull(),
    value: text("value").notNull(),
    moduleId: text("module_id"),
    credentialId: text("credential_id"),
    subjectId: text("subject_id").notNull(),
    revision: text("revision").notNull(),
    verifiedAt: bigint("verified_at", { mode: "number" }),
    active: boolean("active").notNull(),
  },
  (table) => [uniqueIndex("coffee_auth_identifiers_key_0").on(table.namespace, table.value)],
);

const credentials = pgTable(
  "coffee_auth_credentials",
  {
    credentialId: text("credential_id").notNull(),
    subjectId: text("subject_id").notNull(),
    revision: text("revision").notNull(),
    active: boolean("active").notNull(),
  },
  (table) => [uniqueIndex("coffee_auth_credentials_key_0").on(table.credentialId)],
);

const sessions = pgTable(
  "coffee_auth_sessions",
  {
    sessionId: text("session_id").notNull(),
    subjectId: text("subject_id").notNull(),
    digest: text("digest").notNull(),
    securityRevision: text("security_revision").notNull(),
    issuedAt: bigint("issued_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    absoluteExpiresAt: bigint("absolute_expires_at", { mode: "number" }).notNull(),
    record: text("record").notNull(),
  },
  (table) => [
    uniqueIndex("coffee_auth_sessions_key_0").on(table.sessionId),
    uniqueIndex("coffee_auth_sessions_key_1").on(table.digest),
  ],
);

const pending = pgTable(
  "coffee_auth_pending",
  {
    moduleId: text("module_id").notNull(),
    kind: text("kind").notNull(),
    digest: text("digest").notNull(),
    version: text("version").notNull(),
    flowId: text("flow_id").notNull(),
    subjectId: text("subject_id").notNull(),
    bindingDigest: text("binding_digest").notNull(),
    snapshot: text("snapshot").notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    attemptLimit: bigint("attempt_limit", { mode: "number" }).notNull(),
    failedAttempts: bigint("failed_attempts", { mode: "number" }).notNull(),
    consumed: boolean("consumed").notNull(),
  },
  (table) => [uniqueIndex("coffee_auth_pending_key_0").on(table.digest)],
);

const passkeyCredentials = pgTable(
  "coffee_auth_passkeyCredentials",
  {
    credentialId: text("credential_id").notNull(),
    subjectId: text("subject_id").notNull(),
    rpId: text("rp_id").notNull(),
    protocolCredentialId: text("protocol_credential_id").notNull(),
    credentialKey: text("credential_key").notNull(),
    userHandle: text("user_handle").notNull(),
    publicKey: text("public_key").notNull(),
    algorithm: bigint("algorithm", { mode: "number" }).notNull(),
    profile: text("profile").notNull(),
    credentialRevision: text("credential_revision").notNull(),
    active: boolean("active").notNull(),
    primarySignIn: boolean("primary_sign_in").notNull(),
    enrollmentUserVerified: boolean("enrollment_user_verified").notNull(),
    backupEligible: boolean("backup_eligible").notNull(),
    backupState: boolean("backup_state").notNull(),
    counter: bigint("counter", { mode: "number" }).notNull(),
    name: text("name").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    lastUsedAt: bigint("last_used_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("coffee_auth_passkeyCredentials_key_0").on(table.credentialId),
    uniqueIndex("coffee_auth_passkeyCredentials_key_1").on(table.credentialKey),
  ],
);

export const authSchema = {
  subjects,
  passkeyFlows,
  identifiers,
  credentials,
  sessions,
  pending,
  passkeyCredentials,
};
