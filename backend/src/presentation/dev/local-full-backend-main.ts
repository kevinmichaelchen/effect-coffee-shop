import * as Layer from "effect/Layer";
import { BunCoffeeAppLive } from "#runtime/bun/live";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { startCoffeeBunServer } from "#presentation/http/bun-server";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";

// Local "full" backend:
//   - Datastore: SQLite via @effect/sql-sqlite-bun (persists under .data/)
//   - Auth: anonymous actor — Better-Auth's D1 integration is not wired here
//     (see #presentation/auth/local.ts for context).
//   - Assistant: if CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN are set, the
//     existing Workers AI REST path is used; otherwise /assistant returns 503.
//
// A zero-Cloudflare AI path (OpenAI/Anthropic) is a planned follow-up.

await startCoffeeBunServer({
  appLayer: BunCoffeeAppLive,
  portEnv: "COFFEE_HTTP_PORT",
  routes: Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
});
