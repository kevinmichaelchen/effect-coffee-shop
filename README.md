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
```

Run the app:

```bash
bun run http
bun run cli -- menu list
bun run mcp:stdio
```

Check the repo:

```bash
bun run typecheck
bun run lint
bun run lint:custom
bun run fmt:check
bun run test
```
