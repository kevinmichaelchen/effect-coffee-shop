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
bun run mcp:stdio:classic
bun run mcp:http
```

`bun run mcp:stdio` starts the Code Mode MCP server with a single `code` tool.
`bun run mcp:stdio:classic` and `bun run mcp:http` keep the classic multi-tool surface.

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
