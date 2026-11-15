# Coffee Auth

Yielded Auth owns passkey enrollment, authentication, cookies, and stateful sessions; the UI uses the
shared typed contract and Yielded's SimpleWebAuthn browser adapter. Staff membership and every
authorization decision stay server-side: configuration names the staff, the domain model enforces it.

```bash
bun run --cwd packages/coffee/auth test   # real ES256 passkeys against D1 in Miniflare
```

<details>
<summary>What lives where</summary>

- `src/contract.ts`: shared browser/server operations and claims.
- `src/auth.ts`: strategies and session policy (7 day idle, 30 day maximum).
- `src/server.ts`: shared HTTP auth layer and direct session-to-actor middleware.
- `src/oauth.ts`: Yielded OAuth server, durable grants, and per-invocation MCP identity.
- `src/adapters.ts`: replaceable WebCrypto, WebAuthn, and persistence layers. Yielded's
  `WebCrypto.layer` preset supplies Effect 4 crypto services; the legacy `@yielded/crypto` package is
  no longer needed.
- `src/config.ts`: schema-decoded origin, OAuth client, and staff configuration.
- `src/persistence/`: Effect SQL mappings and atomic credential/session writes.
- `src/adapters/d1.ts`: auth storage on D1, with D1 batches as atomic commits (`d1AuthDatabase`).
- `src/migrations.ts`: where the auth SQL migrations live.
- `migrations/0000_auth.sql`: the complete Yielded Auth and OAuth schema for a fresh D1 database.
  Recreate development databases when adopting this baseline; it is not an incremental upgrade.
- `src/testing/`: test helpers, including `migrate.ts`, which applies `migrations/` to a D1 binding.
- `src/yielded/identity.ts`: deployment-owned customer/staff mapping.

</details>

<details>
<summary>Configuration</summary>

`APP_ORIGIN` is the exact public UI origin: HTTPS, or HTTP on literal localhost/127.0.0.1/[::1].
`MCP_SIGNING_KEY` is an independent random key of at least 32 bytes encoded as base64url (generate
with `bun -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'`).
`MCP_CLIENTS` is an optional JSON client registry.

`AUTH_SECRET` is a random secret of at least 32 characters. Set it at deploy time, or leave it unset
and the Coffee Worker's stack generates one and keeps it in Cloudflare Secrets Store (see
[`coffee-server`](../server)). It protects short-lived browser ceremony bindings: if the Worker cannot
read it, auth routes return 503 and application requests are anonymous.

Register a passkey, then use the returned user ID from `/api/me` in the comma-separated
`COFFEE_STAFF_USER_IDS` configuration to grant staff access. IDs are allocated on the server;
registration inputs and session claims cannot grant staff/system authority.

Passkeys are scoped to the site's hostname and verified origin, so use HTTPS except for local
development hosts accepted by Yielded. Creating an account enrolls a passkey and then prompts for a
sign-in assertion; if the second prompt is canceled, the account exists and the user can choose Sign
in.

`0000_auth.sql` creates the complete Yielded Auth schema, OAuth grants, and rate-limit storage.
Alchemy applies it to `coffee-db` on deploy.

</details>

<details>
<summary>Remote MCP</summary>

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

An empty registry disables remote MCP with HTTP 503. With configured clients, unauthenticated requests
receive 401 and OAuth discovery. Clients use authorization code + S256 PKCE, the `coffee:access`
scope, and resource `<APP_ORIGIN>/mcp`. The browser signs in at `/login/mcp` and returns to Yielded's
consent page. Tokens use independent signing material and durable D1 grant storage. Staff authority is
checked on every tool invocation; OAuth scope never grants it, and disabled accounts cannot execute
tools. HTTP clients must support MCP `2026-07-28` and supply its required protocol, method/name
headers and request metadata.

`bun run cf:test` deploys the stack with Alchemy's local Cloudflare emulation and checks that
unauthenticated `/mcp` requests receive 401 with OAuth discovery, and that a passkey-signed-in
customer can place an order through `CustomerApi`.

</details>

Dependency and persistence details: [implementation notes](./YIELDED_AUTH.md).
