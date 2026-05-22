/**
 * Defines Better Auth tables for the Postgres persistence schema.
 *
 * @module
 */
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("createdAt", { withTimezone: true }).notNull();
const updatedAt = () => timestamp("updatedAt", { withTimezone: true }).notNull();

export const usersTable = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessionsTable = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const accountsTable = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verificationTable = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const agentHostsTable = pgTable(
  "agentHost",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    userId: text("userId").references(() => usersTable.id, { onDelete: "cascade" }),
    defaultCapabilities: text("defaultCapabilities"),
    publicKey: text("publicKey"),
    kid: text("kid"),
    jwksUrl: text("jwksUrl"),
    enrollmentTokenHash: text("enrollmentTokenHash"),
    enrollmentTokenExpiresAt: timestamp("enrollmentTokenExpiresAt", { withTimezone: true }),
    status: text("status").notNull(),
    activatedAt: timestamp("activatedAt", { withTimezone: true }),
    expiresAt: timestamp("expiresAt", { withTimezone: true }),
    lastUsedAt: timestamp("lastUsedAt", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("agentHost_userId_idx").on(table.userId),
    index("agentHost_kid_idx").on(table.kid),
    index("agentHost_enrollmentTokenHash_idx").on(table.enrollmentTokenHash),
    index("agentHost_status_idx").on(table.status),
  ],
);

export const agentsTable = pgTable(
  "agent",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    userId: text("userId").references(() => usersTable.id, { onDelete: "cascade" }),
    hostId: text("hostId")
      .notNull()
      .references(() => agentHostsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    mode: text("mode").notNull(),
    publicKey: text("publicKey").notNull(),
    kid: text("kid"),
    jwksUrl: text("jwksUrl"),
    lastUsedAt: timestamp("lastUsedAt", { withTimezone: true }),
    activatedAt: timestamp("activatedAt", { withTimezone: true }),
    expiresAt: timestamp("expiresAt", { withTimezone: true }),
    metadata: text("metadata"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("agent_userId_idx").on(table.userId),
    index("agent_hostId_idx").on(table.hostId),
    index("agent_status_idx").on(table.status),
    index("agent_kid_idx").on(table.kid),
  ],
);

export const agentCapabilityGrantsTable = pgTable(
  "agentCapabilityGrant",
  {
    id: text("id").primaryKey(),
    agentId: text("agentId")
      .notNull()
      .references(() => agentsTable.id, { onDelete: "cascade" }),
    capability: text("capability").notNull(),
    deniedBy: text("deniedBy").references(() => usersTable.id, { onDelete: "cascade" }),
    grantedBy: text("grantedBy").references(() => usersTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expiresAt", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    status: text("status").notNull(),
    reason: text("reason"),
    constraints: text("constraints"),
  },
  (table) => [
    index("agentCapabilityGrant_agentId_idx").on(table.agentId),
    index("agentCapabilityGrant_capability_idx").on(table.capability),
    index("agentCapabilityGrant_grantedBy_idx").on(table.grantedBy),
    index("agentCapabilityGrant_status_idx").on(table.status),
  ],
);

export const approvalRequestsTable = pgTable(
  "approvalRequest",
  {
    id: text("id").primaryKey(),
    method: text("method").notNull(),
    agentId: text("agentId").references(() => agentsTable.id, { onDelete: "cascade" }),
    hostId: text("hostId").references(() => agentHostsTable.id, { onDelete: "cascade" }),
    userId: text("userId").references(() => usersTable.id, { onDelete: "cascade" }),
    capabilities: text("capabilities"),
    status: text("status").notNull(),
    userCodeHash: text("userCodeHash"),
    loginHint: text("loginHint"),
    bindingMessage: text("bindingMessage"),
    clientNotificationToken: text("clientNotificationToken"),
    clientNotificationEndpoint: text("clientNotificationEndpoint"),
    deliveryMode: text("deliveryMode"),
    interval: integer("interval").notNull(),
    lastPolledAt: timestamp("lastPolledAt", { withTimezone: true }),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("approvalRequest_agentId_idx").on(table.agentId),
    index("approvalRequest_hostId_idx").on(table.hostId),
    index("approvalRequest_userId_idx").on(table.userId),
    index("approvalRequest_status_idx").on(table.status),
  ],
);

export const passkeysTable = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("publicKey").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    credentialID: text("credentialID").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("deviceType").notNull(),
    backedUp: boolean("backedUp").notNull(),
    transports: text("transports"),
    createdAt: timestamp("createdAt", { withTimezone: true }),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);

export const authSchema = {
  accountsTable,
  agentCapabilityGrantsTable,
  agentHostsTable,
  agentsTable,
  approvalRequestsTable,
  passkeysTable,
  sessionsTable,
  usersTable,
  verificationTable,
};
