# effect-v4-onion

Simple Onion Architecture playground for a coffee-order application built with TypeScript, Bun, and Effect v4.

## Current setup

- Git repo initialized locally.
- `effect-smol` vendored as a Git submodule at `vendor/effect-smol`.
- `effect-smol` is currently pinned at `dabc272444a700eb629c07ba3e77671a841ca86e`.
- `lintcn` vendored as a Git submodule at `vendor/lintcn`.
- `alchemy-effect` vendored as a Git submodule at `vendor/alchemy-effect`.
- Bun scaffold added with in-memory adapters plus HTTP, CLI, and MCP presentations.
- When Effect examples and memory diverge, update `vendor/effect-smol` and treat that repo as the source of truth.

## What I verified in `effect-smol`

- Bun runtime support exists in `@effect/platform-bun`, including HTTP server, filesystem, stdio, terminal, and `runMain`.
- HTTP APIs are defined with `effect/unstable/httpapi` and served through `effect/unstable/http`.
- CLI support exists in `effect/unstable/cli`.
- MCP server support exists in `effect/unstable/ai` via `McpServer`, `Tool`, and `Toolkit`, with both stdio and HTTP transports.
- The preferred dependency injection style is `ServiceMap.Service` plus `Layer`.
- The preferred function style is `Effect.fn(...)` or `Effect.fnUntraced(...)`.
- The preferred domain/application error style is `Schema.TaggedErrorClass`.

## Brainstorming notes

See [docs/brainstorm.md](docs/brainstorm.md).

Deployment direction:
See [docs/deployment-roadmap.md](docs/deployment-roadmap.md).

Tooling exploration:
See [docs/tooling-notes.md](docs/tooling-notes.md).

## Commands

Install dependencies:

```bash
bun install
```

Run the HTTP API on `http://localhost:3000`:

```bash
bun run http
```

Run the CLI:

```bash
bun run cli -- menu list
bun run cli -- order create --customer-name Avery --drink latte --size large --milk oat --shots 2
bun run cli -- order list
```

Run MCP over stdio:

```bash
bun run mcp:stdio
```

Run MCP over HTTP on `http://localhost:3001/mcp`:

```bash
bun run mcp:http
```

Validate the scaffold:

```bash
bun run typecheck
bun test
```
