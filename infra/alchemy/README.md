# Alchemy Infrastructure Notes

This directory holds deployment graphs, not application composition roots. Keep application behavior in
`apps/` and `packages/`; keep cloud resource wiring here.

It is the `@effect-coffee-shop/infra-alchemy` workspace. `alchemy.run.ts` selects the default stack for
the root `infra:*` scripts; `cloudflare.ts` and `aws.ts` back the `cf:*` and `aws:*` scripts. The root
scripts run the `alchemy` CLI from the repository root, and the stacks resolve cross-workspace paths
(the UI root and the D1 migrations directory) from their own location, so the same files work under
`bun run cf:test`, which Turbo runs from this directory. The workspace depends on the backend, the
Cloudflare runtime and the UI so Turbo re-runs the smoke test when any bundled source changes.

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

## Drizzle.Schema Fit

`alchemy-effect` can manage Drizzle schema migrations as a deploy-time resource. That fits
Drizzle-backed paths such as the Postgres adapter or future Neon/Planetscale experiments.

Do not apply `Drizzle.Schema` to the current Cloudflare D1 path by default. The D1 deployment uses
the checked-in SQL migrations under
`packages/coffee/external/sqlite/src/sql/migrations`, and mixing deploy-time Drizzle generation into
that path would create two migration authorities.

Use `Drizzle.Schema` here only after choosing to make a Drizzle schema the source of truth for that
database surface.

## Auth and provider configuration

Both stacks pass `APP_ORIGIN`, `AUTH_SECRET`, `MCP_SIGNING_KEY`, `MCP_CLIENTS`, and
`COFFEE_STAFF_USER_IDS` to the runtime. Configure the exact public website origin;
the application never infers its trusted origin from incoming requests. The MCP
signing key is separate from the browser ceremony secret. `MCP_CLIENTS=[]` disables
remote MCP. See [auth setup](../../packages/coffee/auth/README.md) for the registry.

Cloudflare provisions D1 and applies the SQL migrations. AWS still requires an
external `COFFEE_POSTGRES_URL`; this stack does not provision PostgreSQL. Shared
application code depends on Effect services, with each runtime selecting its SQL
adapter. Request scopes own disposable clients and MCP fibers on both platforms.

Route `/api/*`, `/mcp`, `/oauth/*`, and `/.well-known/*` to the backend. `/login/mcp`
is an application page served by the static website; it returns successful sign-in
to Yielded's consent endpoint. The local Alchemy test checks that unauthenticated
MCP requests receive OAuth discovery with HTTP 401.
