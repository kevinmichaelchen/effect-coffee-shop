# effect-v4-onion

Coffee-order application used to explore Onion Architecture with TypeScript, Bun, and Effect v4.

This repo is split into two Bun workspaces:

- `backend/` for the Effect-based HTTP, CLI, and MCP server
- `ui/` for the standalone browser frontend

The backend now lives in `backend/` and keeps the boundaries explicit:

- `backend/src/domain` for business types and rules
- `backend/src/service` for use cases and ports
- `backend/src/external` for adapter implementations
- `backend/src/presentation` for HTTP, CLI, and MCP entrypoints

Most tests run against in-memory adapters. A small contract suite also runs against the SQL-backed repositories.

## Commands

Install dependencies:

```bash
bun install
bun run hooks:install
```

This repo uses Bun workspaces. The root `bun install` covers both [`backend/`](./backend) and [`ui/`](./ui).
Turborepo is the canonical root task runner for dev, build, and quality checks, so repeated runs can reuse the `.turbo` cache across workspaces and `--affected` can skip unrelated work.

Run the app:

```bash
bun run dev
bun run http
bun run cli -- menu list
bun run mcp:stdio
bun run mcp:http
```

`bun run dev` starts the backend HTTP server and the frontend Vite dev server together through Turborepo.
`bun run mcp:stdio` starts the classic MCP server over stdio with direct coffee action tools, prompts, and resources.
`bun run mcp:http` serves the same classic MCP surface over HTTP at `/mcp`.

Run the Worker-safe MCP contract locally on Miniflare:

```bash
bun run --cwd backend test test/presentation/mcp/miniflare-http.test.ts
```

This exercises the MCP HTTP surface end-to-end on Miniflare against a Worker entrypoint.
It covers the same classic MCP surface as the local HTTP server: prompts, resources, and direct coffee action tools.

Check the repo:

```bash
bun run typecheck
bun run lint
bun run fmt:check
bun run test
bun run check
```

Build workspace artifacts from the repo root:

```bash
bun run build
```

Run only the tasks affected by the current branch:

```bash
bun run check:affected
bun run build:affected
bun run test:affected
bun run affected:packages
```

Run the configured Git hooks without committing or pushing:

```bash
bun run hooks:run:pre-commit
bun run hooks:run:pre-push
```

Run Storybook from the repo root:

```bash
bun run storybook
bun run build-storybook
```

`bun run storybook` serves the UI stories through Turborepo on port `6006` by default, and `bun run build-storybook` writes the static output to [`ui/storybook-static`](./ui/storybook-static).

## UI

A standalone browser UI lives in [`ui/`](./ui).

Run the backend from the repo root:

```bash
bun run http
```

Then start the frontend:

```bash
bun run --cwd ui dev
```

Run Storybook only for the UI workspace:

```bash
bun run --cwd ui storybook
bun run --cwd ui build-storybook
```

For HTTP-only subdomain-based local development with [`portless`](https://github.com/vercel-labs/portless):

```bash
bun add -g portless

bun run dev:onion:api
bun run dev:onion:ui
```

This repo runs Portless on a dedicated HTTP-only proxy at port `1365` with an isolated state directory at `/tmp/effect-v4-onion-portless`, so it does not interfere with any other Portless daemon you already have running.
That serves an in-memory backend with the REST API plus MCP HTTP endpoint on `http://api.onion.localhost:1365`, and the frontend UI on `http://onion.localhost:1365`.

This HTTP flow avoids HTTPS trust prompts and does not require `sudo`. It relies on `.localhost` resolution in the browser. It works on Chrome, Firefox, and Edge. Safari may still require host syncing, which Portless documents as a privileged operation.
