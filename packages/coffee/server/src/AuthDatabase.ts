/**
 * The D1 database that holds auth state: passkeys, sessions and MCP OAuth
 * grants. Orders, carts and checkouts live in the domain model, on Durable
 * Objects, not here.
 *
 * @module
 */
import * as Cloudflare from "alchemy/Cloudflare";

// Anchored on this module, so deploys from the repo root and tests from a
// workspace directory resolve the same folder.
const migrations = decodeURIComponent(new URL("../../auth/migrations", import.meta.url).pathname);

export const AuthDatabase = Cloudflare.D1.Database("coffee-db", { migrations });
