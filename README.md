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
Backend tests use a hybrid layout: source-owned tests live beside the code in `backend/src/**/*.test.ts`, while shared support, contracts, and cross-boundary integration workflows stay centralized under `backend/test`.

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
bun run --cwd backend test src/presentation/mcp/miniflare.worker.test.ts
```

This exercises the MCP HTTP surface end-to-end on Miniflare against a Worker entrypoint.
It covers the same classic MCP surface as the local HTTP server: prompts, resources, and direct coffee action tools.

Deploy the Cloudflare candidate stack with upstream Alchemy:

```bash
bun run cf:configure
bun run cf:login
bun run cf:dev -- --profile default
bun run cf:deploy -- --profile default
```

This candidate stack is defined in [`alchemy.run.ts`](./alchemy.run.ts) and deploys one Cloudflare Website resource that serves the built UI, the Effect HTTP API under `/api/*`, and the MCP HTTP surface under `/mcp`.
The deployed Worker uses a D1 binding, so the browser app, API, and remote MCP server share the same origin and runtime.
Classic stdio MCP is still Bun-only and is not part of the Cloudflare deployment.

Alchemy state stays local under `.alchemy/` by default.
If you want remote shared state later, set `ALCHEMY_STATE_TOKEN` and the stack will switch to `CloudflareStateStore`.
If you start binding secret values with `alchemy.secret(...)`, set `ALCHEMY_PASSWORD` so Alchemy can encrypt them in state.
Check the repo:

```bash
bun run typecheck
bun run lint
bun run lint:custom
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

## Cloudflare candidate

This branch includes a candidate Cloudflare deployment scaffold using upstream Alchemy instead of the vendored `alchemy-effect` package.

The current shape is:

- one Alchemy `Website` resource
- `ui/dist` served as static assets
- `/api/*` rewritten into the existing Effect `HttpApi`
- `/mcp` handled by the existing MCP HTTP server
- `D1` provisioned and bound into the Worker

Expected workflow:

```bash
bun run cf:configure
bun run cf:login
bun run cf:dev -- --profile default
bun run cf:deploy -- --profile default
```

You can target a non-default profile or stage with the normal Alchemy flags, for example:

```bash
bun run cf:deploy -- --profile personal --stage dev_kchen
```

Because this repo does not yet have Cloudflare credentials checked in or configured locally, treat this as a reviewable candidate rather than a verified deployment recipe.
