# Alchemy Infrastructure Notes

This directory holds deployment graphs, not application composition roots. Keep application behavior in
`apps/` and `packages/`; keep cloud resource wiring here.

It is the `@effect-coffee-shop/infra-alchemy` workspace. `cloudflare.ts` is the only stack;
`alchemy.run.ts` re-exports it, so the root `infra:*` and `cf:*` scripts deploy the same graph, and
`bun run dev` runs it under `alchemy dev`. The stack contains:

- `CoffeeWorker` from [`coffee-server`](../../packages/coffee/server): the domain model on Durable
  Objects, the D1 auth database `coffee-db` (migrations in
  [`packages/coffee/auth/migrations`](../../packages/coffee/auth/migrations)), and the
  `AUTH_SECRET` in Secrets Store.
- `Cloudflare.Website.Vite("onion")` for [`apps/ui`](../../apps/ui), whose `src/worker.ts`
  forwards `/api`, `/mcp`, `/oauth/`, and `/.well-known/` to the Coffee Worker over the `COFFEE`
  service binding, so the app and the Apis share one origin.
- An optional deploy smoke check (`COFFEE_DEPLOY_SMOKE_CHECKS`, `COFFEE_DEPLOY_SMOKE_MCP`).

The root scripts run the `alchemy` CLI from the repository root, and the stack resolves the UI root
from its own location, so the same file works under `bun run cf:test`, which Turbo runs from this
directory. The workspace depends on `coffee-server` and the UI so Turbo re-runs the test when any
bundled source changes.

## Tests

`cloudflare.test.ts` deploys the stack with Alchemy's local Cloudflare emulation and checks
`/api/health`, that `/mcp` answers 401 with OAuth discovery, that retired endpoints return 404,
and an end-to-end flow: passkey registration and sign-in, `CustomerApi.PlaceOrder` on Durable
Objects, then the order appearing in the `CustomerOrders` view.

## Custom Infrastructure Glue

If this workspace needs infrastructure that Alchemy does not model yet, implement it with the same
lifecycle discipline used by `alchemy-effect` providers:

- Observe live state before mutating it.
- Separate diff decisions from reconciliation where the API supports it.
- Make reconciliation idempotent across partial state writes and retryable deploys.
- Treat account-level Cloudflare resources as adoptable shared infrastructure unless deletion is
  explicitly safe.
- Declare stable output attributes so downstream resources do not churn.
- Translate expected cloud API races such as already-exists and not-found into typed Effect errors
  and handle them with tagged recovery.
- Use bounded `Effect.retry` schedules for eventual consistency rather than unbounded loops or
  one-off sleeps.

Avoid one-off deploy scripts for resources that should be part of the graph. If a helper needs
state, adoption, deletion policy, or downstream references, model those semantics explicitly before
using it in a production stack.

## Auth and provider configuration

The Coffee Worker reads `APP_ORIGIN`, `MCP_SIGNING_KEY`, `MCP_CLIENTS`,
`COFFEE_STAFF_USER_IDS`, and `AUTH_SECRET` through Effect `Config` at deploy time; Alchemy binds
those reads to the Worker. `AUTH_SECRET` is optional: when unset, `Alchemy.Random` generates one
and keeps it across deploys. Configure the exact public website origin;
the application never infers its trusted origin from incoming requests. The MCP
signing key is separate from the browser ceremony secret. `MCP_CLIENTS=[]` disables
remote MCP. See [auth setup](../../packages/coffee/auth/README.md) for the registry.

D1 holds only auth state (passkeys, sessions, OAuth grants); orders, carts, and checkouts live in
the domain model on Durable Objects. Each request builds and releases its own route graph, so
disposable clients and MCP fibers are request-scoped.

The Website Worker routes `/api/*`, `/mcp`, `/oauth/*`, and `/.well-known/*` to the Coffee Worker. `/login/mcp`
is an application page served by the static website; it returns successful sign-in
to Yielded's consent endpoint. The local Alchemy test checks that unauthenticated
MCP requests receive OAuth discovery with HTTP 401.
