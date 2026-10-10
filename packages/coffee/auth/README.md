# Coffee Auth

Yielded Auth owns passkey enrollment, authentication, cookies, and stateful
sessions. Better Auth has been removed. The UI uses the shared typed contract
and Yielded's SimpleWebAuthn browser adapter.

- `src/contract.ts`: shared browser/server operations and claims.
- `src/auth.ts`: strategies and session policy (7 day idle, 30 day maximum).
- `src/server.ts`: shared HTTP auth layer and direct session-to-actor middleware.
- `src/oauth.ts`: Yielded OAuth server, durable grants, and per-invocation MCP identity.
- `src/adapters.ts`: replaceable WebCrypto, WebAuthn, and persistence layers.
- `src/config.ts`: schema-decoded origin and OAuth client configuration.
- `src/persistence/`: Effect SQL mappings and atomic credential/session writes.
- `src/database.ts`: PostgreSQL/SQLite transactions and D1 atomic batches.
- `src/yielded/identity.ts`: deployment-owned customer/staff mapping.

## Configuration

Set `AUTH_SECRET` to a random secret of at least 32 characters on Cloudflare,
AWS, or Bun. Configure `APP_ORIGIN` as the exact public UI origin (HTTPS, or HTTP
on literal localhost/127.0.0.1/[::1]) and `MCP_SIGNING_KEY` as an independent
random key of at least 32 bytes encoded as base64url (generate with
`bun -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'`). `AUTH_SECRET` protects short-lived browser ceremony bindings. Without it,
auth routes return 503 and application requests are anonymous.

Register a passkey, then use the returned user ID from `/api/me` in the
comma-separated `COFFEE_STAFF_USER_IDS` configuration to grant staff access.
IDs are allocated on the server. Registration inputs and session claims cannot
grant staff/system authority. Application use cases continue to enforce staff
permissions for queue and order management.

Passkeys are scoped to the site's hostname and verified origin. Use HTTPS,
except for local development hosts accepted by Yielded. Creating an account
first enrolls a passkey and then prompts for a sign-in assertion. If the second
prompt is canceled, the account exists and the user can choose Sign in.

## Prototype cutover

There are no existing users to preserve. SQLite migration `0004_yielded_auth.sql`
and PostgreSQL migration `20261008120000_yielded_auth` remove legacy auth and
Agent Auth tables and create Yielded's storage. Old passkeys and sessions are
not imported. Coffee menu/order/cart tables are preserved.

Rename deployed `BETTER_AUTH_SECRET` configuration to `AUTH_SECRET` and apply
normal database migrations with the new deployment. Bun HTTP also exposes
`/api/auth/*`; its auth database uses `COFFEE_SQLITE_PATH` (default
`.data/coffee.sqlite`), including the local application development server. All HTTP runtimes expose
the application API under `/api`; development proxies preserve that prefix.

## Verification

`bun run --cwd packages/coffee/auth test` runs real ES256 registration and
assertion verification against D1 in Miniflare and PostgreSQL in PGlite, using
committed migrations. It covers ceremony binding/replay, actor authority,
logout revocation, expiry, and wrong-origin rejection. These are software
authenticators; physical devices and deployed infrastructure are separate checks.

See [implementation notes](./YIELDED_AUTH.md) for dependency and persistence details.

## Remote MCP

Set `MCP_CLIENTS` to an explicit JSON client registry to enable `/mcp`:

```json
[
  {
    "clientId": "inspector",
    "name": "MCP Inspector",
    "redirectUris": ["http://localhost:6274/oauth/callback"]
  }
]
```

An empty registry disables remote MCP with HTTP 503. With configured clients,
unauthenticated requests receive 401 and OAuth discovery. Clients use authorization
code + S256 PKCE, the `coffee:access` scope, and resource `<APP_ORIGIN>/mcp`.
The browser signs in at `/login/mcp` and returns to Yielded's consent page.
Tokens use independent signing material and durable D1/PostgreSQL grant storage.
Migrations `0005_mcp_oauth.sql` / `20261010120000_mcp_oauth` contain Yielded's
published OAuth schema. Staff authority is checked on every tool invocation;
OAuth scope never grants staff authority. Disabled accounts cannot execute tools.

HTTP clients must support MCP `2026-07-28` and supply its required protocol,
method/name headers and request metadata. Stdio remains a local trusted operator.

`bun run --cwd packages/coffee/backend test` verifies the complete browser → OAuth
→ MCP flow on D1 and PGlite, including customer/staff permissions across fresh
request runtimes. These local tests do not deploy to either provider.
