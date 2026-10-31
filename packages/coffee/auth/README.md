# Coffee Auth

Yielded Auth owns passkey enrollment, authentication, cookies, and stateful
sessions. The UI uses the shared typed contract
and Yielded's SimpleWebAuthn browser adapter.

- `src/contract.ts`: shared browser/server operations and claims.
- `src/auth.ts`: strategies and session policy (7 day idle, 30 day maximum).
- `src/server.ts`: shared HTTP auth layer and direct session-to-actor middleware.
- `src/oauth.ts`: Yielded OAuth server, durable grants, and per-invocation MCP identity.
- `src/adapters.ts`: replaceable WebCrypto, WebAuthn, and persistence layers.
  Yielded's `WebCrypto.layer` preset supplies Effect 4.1 crypto services; the legacy
  `@yielded/crypto` package is no longer needed. Alchemy OAuth and Yielded Cloudflare
  Sync still require the Effect Crypto compatibility patch.
- `src/config.ts`: schema-decoded origin and OAuth client configuration.
- `src/persistence/`: Effect SQL mappings and atomic credential/session writes.
- `src/database.ts`: D1 atomic batches (`d1AuthDatabase`) and a generic transactional SQL layer.
- `migrations/0000_auth.sql`: the complete Yielded Auth and OAuth schema for a fresh D1 database.
  Recreate development databases when adopting this baseline; it is not an incremental upgrade.
- `src/testing/`: test helpers, including `migrate.ts`, which applies `migrations/` to a D1 binding.
- `src/yielded/identity.ts`: deployment-owned customer/staff mapping.

## Configuration

`AUTH_SECRET` is a random secret of at least 32 characters. Set it at deploy
time, or leave it unset and the Coffee Worker's stack generates one and keeps it
in Cloudflare Secrets Store (see [`coffee-server`](../server)). Configure `APP_ORIGIN` as the exact public UI origin (HTTPS, or HTTP
on literal localhost/127.0.0.1/[::1]) and `MCP_SIGNING_KEY` as an independent
random key of at least 32 bytes encoded as base64url (generate with
`bun -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'`). `AUTH_SECRET` protects short-lived browser ceremony bindings. If the Worker
cannot read it, auth routes return 503 and application requests are anonymous.

Register a passkey, then use the returned user ID from `/api/me` in the
comma-separated `COFFEE_STAFF_USER_IDS` configuration to grant staff access.
IDs are allocated on the server. Registration inputs and session claims cannot
grant staff/system authority. The domain model enforces staff permissions for
queue and order management.

Passkeys are scoped to the site's hostname and verified origin. Use HTTPS,
except for local development hosts accepted by Yielded. Creating an account
first enrolls a passkey and then prompts for a sign-in assertion. If the second
prompt is canceled, the account exists and the user can choose Sign in.

## Database

`0000_auth.sql` creates the complete Yielded Auth schema, OAuth grants, and rate-limit storage. Alchemy applies it to `coffee-db` on deploy.

## Verification

`bun run --cwd packages/coffee/auth test` runs real ES256 registration and
assertion verification against D1 in Miniflare, using the committed migrations. It covers ceremony binding/replay, actor authority,
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
Tokens use independent signing material and durable D1 grant storage.
Migration `0000_auth.sql` contains Yielded's published OAuth schema. Staff authority is checked on every tool invocation;
OAuth scope never grants staff authority. Disabled accounts cannot execute tools.

HTTP clients must support MCP `2026-07-28` and supply its required protocol,
method/name headers and request metadata.

`bun run cf:test` deploys the stack with Alchemy's local Cloudflare emulation
and checks that unauthenticated `/mcp` requests receive 401 with OAuth discovery,
and that a passkey-signed-in customer can place an order through `CustomerApi`.
