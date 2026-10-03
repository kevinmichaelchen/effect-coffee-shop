/**
 * Defines Better Auth tables for SQLite and D1 deployments.
 *
 * @module
 */
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";

const auth = betterAuth({
  appName: "Effect Coffee Shop",
  basePath: "/api/auth",
  baseURL: "http://localhost",
  database: new Database(":memory:"),
  plugins: [
    passkey({
      registration: {
        requireSession: false,
      },
      rpName: "Effect Coffee Shop",
    }),
  ],
  secret: "schema-generation-only-secret-0001",
  telemetry: {
    enabled: false,
  },
});

export default auth;
