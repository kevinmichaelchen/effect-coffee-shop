# effect-v4-onion

Coffee-order application used to explore Onion Architecture with TypeScript, Bun, and Effect v4.

The app keeps the boundaries explicit:

- `src/domain` for business types and rules
- `src/service` for use cases and ports
- `src/external` for adapter implementations
- `src/presentation` for HTTP, CLI, and MCP entrypoints

Most tests run against in-memory adapters. A small contract suite also runs against the SQL-backed repositories.

`vendor/effect-smol` is the local source of truth for Effect v4 APIs and conventions when examples drift.

## Commands

Install dependencies:

```bash
bun install
bun run hooks:install
```

Run the app:

```bash
bun run http
bun run cli -- menu list
bun run mcp:stdio
bun run mcp:http
```

`bun run mcp:stdio` starts the classic MCP server over stdio with direct coffee action tools, prompts, and resources.
`bun run mcp:http` serves the same classic MCP surface over HTTP at `/mcp`.

Run the Worker-safe MCP contract locally on Miniflare:

```bash
bun run test test/presentation/mcp/miniflare-http.test.ts
```

This exercises the MCP HTTP surface end-to-end on Miniflare against a Worker entrypoint.
It covers the same classic MCP surface as the local HTTP server: prompts, resources, and direct coffee action tools.

Deploy the HTTP API to Cloudflare with Alchemy:

```bash
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...

bun ./vendor/alchemy-effect/alchemy-effect/bin/alchemy-effect.ts plan ./alchemy.run.ts --stage dev_kchen
bun ./vendor/alchemy-effect/alchemy-effect/bin/alchemy-effect.ts deploy ./alchemy.run.ts --stage dev_kchen
```

This first Alchemy stack deploys only the HTTP API Worker from [`alchemy.run.ts`](./alchemy.run.ts) and [`alchemy/coffee-http.worker.ts`](./alchemy/coffee-http.worker.ts).
It intentionally uses the in-memory app layer for now, because the vendored `alchemy-effect` Cloudflare providers in this repo do not provision D1 yet.

Check the repo:

```bash
bun run typecheck
bun run lint
bun run lint:custom
bun run fmt:check
bun run test
```

Run the configured Git hooks without committing or pushing:

```bash
bun run hooks:run:pre-commit
bun run hooks:run:pre-push
```
