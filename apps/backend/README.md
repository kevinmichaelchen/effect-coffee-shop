# Backend App

`@effect-coffee-shop/backend` is the thin backend app workspace.

It keeps deployable entrypoints, local backend scripts, and backend integration tests. Runtime and
backend composition live in packages so deployment shape can be changed by swapping the entrypoint or
Alchemy stack wiring rather than editing route internals.

See [`../../packages`](../../packages) for the package map this app composes.

## Runtime Surfaces

- [`src/bun`](./src/bun): one-line local Bun entrypoints.
- [`src/cloudflare`](./src/cloudflare): one-line Cloudflare Worker entrypoints.
- [`src/aws`](./src/aws): one-line AWS Lambda entrypoints.
- [`test`](./test): backend integration and deployment-surface contract tests.
- [`scripts`](./scripts): local measurement and maintenance scripts.

## Boundary Rule

Keep this workspace small. Reusable backend composition belongs in
[`coffee/backend`](../../packages/coffee/backend), runtime adapters belong in
[`coffee/runtime`](../../packages/coffee/runtime), and Coffee behavior stays in the domain,
application, presentation, and infrastructure packages under [`packages/coffee`](../../packages/coffee).

## Commands

```bash
bun run --cwd apps/backend http
bun run --cwd apps/backend cli
bun run --cwd apps/backend mcp:stdio
bun run --cwd apps/backend mcp:http
bun run --cwd apps/backend dev:local:api
bun run --cwd apps/backend test
bun run --cwd apps/backend typecheck
bun run --cwd apps/backend lint
bun run --cwd apps/backend lint:custom
bun run --cwd apps/backend fmt:check
```

## Local Test Suite

The backend tests are local-only. Cloudflare-shaped coverage runs through Miniflare, not a real
Cloudflare account, and assistant/model tests use fake local providers.

Use the root full-local gate when you want unit, integration, Storybook browser, custom lint,
Fallow, and the Postgres repository contract in one command:

```bash
bun run test:local:full
```

That script starts a disposable local Postgres container, runs the forced Turborepo test gate, runs
the Drizzle/Postgres contract with `COFFEE_POSTGRES_TEST_URL`, then removes the container. The
Postgres adapter keeps its direct contract-test details in
[`coffee-external-drizzle-postgres`](../../packages/coffee/external/drizzle-postgres/README.md).

Database helper commands proxy to the
[`SQLite external package`](../../packages/coffee/external/sqlite):

```bash
bun run --cwd apps/backend db:check
bun run --cwd apps/backend db:generate
bun run --cwd apps/backend db:migrate
```
