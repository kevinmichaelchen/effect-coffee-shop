# Coffee Server

`@effect-coffee-shop/coffee-server` is the Coffee Shop backend: one Effect
`Cloudflare.Worker` that hosts the [`coffee-domain`](../domain) model on Durable
Objects and serves every backend path. It is the only composition root; the
[Alchemy stack](../../../infra/alchemy) deploys it.

## Routes

| Path                                        | Served by                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `/api/customer`, `/api/staff`               | The domain's `CustomerApi` and `StaffApi` (Effect RPC), behind the auth session |
| `/api/auth/*`, `/oauth/*`, `/.well-known/*` | Yielded Auth passkeys and MCP OAuth ([`coffee-auth`](../auth))                  |
| `/api/health`, `/api/menu`, `/api/me`       | REST ([`coffee-http`](../presentation/http))                                    |
| `/mcp`                                      | Remote MCP tools over `CoffeeOrderApp` ([`coffee-mcp`](../presentation/mcp))    |

The browser never calls this Worker directly: the UI's Website Worker forwards
these paths to it over the `COFFEE` service binding, so both share one origin.

## Files

- [`src/CoffeeWorker.ts`](./src/CoffeeWorker.ts): the Worker. It builds the
  `CoffeeShop` model on `DomainCloudflare.DurableObjects` (every order, cart, and
  view key is its own object), routes each request, and wraps it in one wide
  event from [`http-routing`](../../http-routing).
- [`src/CoffeeHttp.ts`](./src/CoffeeHttp.ts): the HTTP surface around the Apis:
  auth routes, REST, MCP with its OAuth server, and `domainApi`, which resolves
  the caller's session before handing the request to an Api. Mutating Api calls
  must come from `APP_ORIGIN`; bearer tokens are rejected on app routes (agents
  use MCP). Each request builds and releases its own route graph.
- [`src/Session.ts`](./src/Session.ts): implements the domain's `Session`
  middleware. The Worker resolves the actor from the session cookie and passes
  it in the `x-coffee-actor` header, which only the Worker sets: any copy a
  client sends is removed first.
- [`src/AuthDatabase.ts`](./src/AuthDatabase.ts): the D1 database `coffee-db`.
  It holds only auth state (passkeys, sessions, OAuth grants); migrations live
  in [`packages/coffee/auth/migrations`](../auth/migrations).
- [`src/AuthSecret.ts`](./src/AuthSecret.ts): the `AUTH_SECRET` in Cloudflare
  Secrets Store. Set `AUTH_SECRET` to choose it; otherwise `Alchemy.Random`
  generates one and keeps it across deploys.

## Configuration

The Worker reads `APP_ORIGIN`, `MCP_SIGNING_KEY`, `MCP_CLIENTS`,
`COFFEE_STAFF_USER_IDS`, and `AUTH_SECRET` through Effect `Config` at deploy
time; Alchemy binds those reads. If the auth secret is unavailable, auth paths
and `/mcp` answer 503 and everything else runs anonymously. See
[auth setup](../auth/README.md).

## Tests

[`test/CoffeeApis.test.ts`](./test/CoffeeApis.test.ts) runs the same Layer with
`Domain.InMemory` in place of `DomainCloudflare.DurableObjects`: customers and
staff through the Apis, authorization (sessions, staff-only commands, owners'
reads), `CoffeeOrderApp` checkout and error translation, and the session
header. The deployed stack, including Durable Objects and passkey sign-in, is
tested in [`infra/alchemy/cloudflare.test.ts`](../../../infra/alchemy/cloudflare.test.ts).

```bash
bun run --cwd packages/coffee/server typecheck
bun run --cwd packages/coffee/server lint
bun run --cwd packages/coffee/server test
```
