# Backend App

`@effect-coffee-shop/backend` is the composition root for backend runtimes.

It chooses concrete persistence, auth, host, and presentation layers for deployable entrypoints. The
library packages define reusable Coffee behavior and adapters; this app decides how those pieces are
assembled for Bun, Cloudflare Workers, and AWS Lambda.

## Runtime Surfaces

- `src/platforms/bun`: local HTTP, CLI, MCP stdio, MCP HTTP, and local development entrypoints.
- `src/platforms/cloudflare`: Worker runtime composition, Cloudflare environment decoding, static
  asset routing, D1 persistence, auth, assistant, HTTP API, and MCP mounts.
- `src/platforms/aws`: Lambda and router composition for AWS deployments.
- `src/host`: shared Fetch-runtime mount wiring used by platform-specific shells.
- `src/app-layer.ts`: default persistent Coffee application layer for local backend entrypoints.

## Boundary Rule

Runtime-specific binding decoding and layer composition belong here. Domain rules, application use
cases, action contracts, and presentation protocol definitions stay in their package workspaces.

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

Database helper commands proxy to the SQLite external package:

```bash
bun run --cwd apps/backend db:check
bun run --cwd apps/backend db:generate
bun run --cwd apps/backend db:migrate
```
