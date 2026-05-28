# Backend App

`@effect-coffee-shop/backend` is the composition root for backend runtimes.

It chooses concrete persistence, auth, host, and presentation layers for deployable entrypoints. The
library packages define reusable Coffee behavior and adapters; this app decides how those pieces are
assembled for Bun, Cloudflare Workers, and AWS Lambda.

See [`../../packages`](../../packages) for the package map this app composes.

## Runtime Surfaces

- [`src/platforms/bun`](./src/platforms/bun): local HTTP, CLI, MCP stdio, MCP HTTP, and local
  development entrypoints.
- [`src/platforms/cloudflare`](./src/platforms/cloudflare): Worker runtime composition, Cloudflare
  environment decoding, static asset routing, D1 persistence, auth, assistant, HTTP API, and MCP
  routes.
- [`src/platforms/aws`](./src/platforms/aws): Lambda and router composition for AWS deployments.
- [`src/http`](./src/http): shared HTTP route wiring used by platform-specific shells.
- [`src/app-layer.ts`](./src/app-layer.ts): default persistent Coffee application layer for local
  backend entrypoints.

## Boundary Rule

Runtime-specific binding decoding and layer composition belong here. Domain rules and application use
cases stay in [`coffee-core`](../../packages/coffee/core), action contracts stay in
[`coffee-actions`](../../packages/coffee/presentation/actions), and presentation protocol definitions stay in the
[`coffee-http`](../../packages/coffee/presentation/http),
[`coffee-mcp`](../../packages/coffee/presentation/mcp), and
[`coffee-cli`](../../packages/coffee/presentation/cli).

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
