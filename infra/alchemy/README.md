# Alchemy Infrastructure Notes

This directory holds deployment graphs, not application composition roots. Keep application behavior in
`apps/` and `packages/`; keep cloud resource wiring here.

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
the checked-in SQL/sqlfu migrations under
`packages/coffee/external/sqlite/src/sql/migrations`, and mixing deploy-time Drizzle generation into
that path would create two migration authorities.

Use `Drizzle.Schema` here only after choosing to make a Drizzle schema the source of truth for that
database surface.
