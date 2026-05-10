# effect-coffee-shop

Coffee-ordering app used to explore Onion Architecture with TypeScript, Bun,
and Effect.

This is a Bun workspace monorepo. The backend composes the Coffee domain for
Bun and Cloudflare runtimes; the browser app is a separate Vite/React
workspace.

## Layout

- [`apps/backend`](./apps/backend): composition root for HTTP, CLI, MCP, Bun,
  and Cloudflare Worker entrypoints.
- [`apps/ui`](./apps/ui): standalone browser UI. See
  [`apps/ui/README.md`](./apps/ui/README.md).
- [`packages`](./packages): Coffee domain, application, presentation, auth,
  assistant, backend-host, and external adapter packages. See
  [`packages/README.md`](./packages/README.md).
- Package-specific notes live in
  [`coffee/actions`](./packages/coffee/actions),
  [`coffee/assistant`](./packages/coffee/assistant),
  [`coffee/auth`](./packages/coffee/auth), and
  the external adapters:
  [`in-memory`](./packages/coffee/external/in-memory),
  [`sqlite`](./packages/coffee/external/sqlite), and
  [`drizzle-postgres`](./packages/coffee/external/drizzle-postgres).

## Setup

Use the Bun version from [`package.json`](./package.json):

```bash
bun install
```

The root install covers all workspaces, uses the root dependency catalog, and
installs local Git hooks outside CI.

## Run

```bash
bun run dev
```

That starts the backend HTTP server and UI dev server through Turborepo.

Common entrypoints:

```bash
bun run http
bun run cli -- menu list
bun run mcp:stdio
bun run mcp:http
```

UI docs cover local proxy, Portless, passkey, and assistant environment setup.

## Commands

```bash
bun run check
bun run check:affected
bun run build
bun run storybook
bun run build-storybook
```

Workspace gates:

```bash
bun run --cwd apps/backend check
bun run --cwd apps/ui check
```

Cloudflare candidate stack:

```bash
bun run cf:configure
bun run cf:login
bun run cf:dev -- --profile default
bun run cf:deploy -- --profile default
```

Hook checks:

```bash
bun run hooks:run:pre-commit
bun run hooks:run:pre-push
```

## Notes

- Root tasks are run by Turborepo.
- `check:affected`, `build:affected`, and `test:affected` use Turborepo's
  affected mode against the current branch.
- `bun run tsgo:patch` opts into the Effect TypeScript language service binary;
  `bun run tsgo:unpatch` restores the stock native TypeScript binary.
- Local Beanline AI provider setup is documented in
  [`apps/ui/README.md`](./apps/ui/README.md) and
  [`coffee/assistant`](./packages/coffee/assistant).
