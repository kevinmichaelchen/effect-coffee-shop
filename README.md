# effect-coffee-shop

Coffee-order application used to explore Onion Architecture with TypeScript, Bun, and Effect v4.

This repo is split into Bun workspaces with a domain-centric layout:

- `apps/backend/` for the Effect-based HTTP, CLI, MCP, Bun, and Cloudflare presentation app
- `apps/ui/` for the standalone browser frontend
- `packages/domains/coffee/core/` for the Coffee bounded context Onion Core: domain types, rules, service ports, and use cases
- `packages/domains/coffee/external-in-memory/` for the Coffee in-memory External Layer implementation
- `packages/domains/coffee/external-sqlite/` for the Coffee SQLFU-backed SQLite/D1 External Layer implementation

The backend selects its default local External Layer in `apps/backend/src/app-layer.ts`.
Switching the Bun app between SQLite and in-memory should be a one-line export change there.

The main boundaries are:

- `packages/domains/coffee/core/src/domain` for Coffee business types and rules
- `packages/domains/coffee/core/src/service` for Coffee use cases and ports
- `packages/domains/coffee/external-*/src` for Coffee adapter implementations
- `apps/backend/src/cloudflare` and `apps/backend/src/bun` for HTTP, CLI, MCP, and Worker entrypoints

Most tests run against in-memory adapters. A small contract suite also runs against the SQL-backed repositories.
Backend tests use a hybrid layout: source-owned tests live beside the code in `apps/backend/src/**/*.test.ts`, while shared support, contracts, and cross-boundary integration workflows stay centralized under `apps/backend/test`.

## Commands

Install dependencies:

```bash
bun install
```

This repo uses Bun workspaces and Bun Catalogs. The root `bun install` covers applications in [`apps/`](./apps) and libraries in [`packages/`](./packages).
Dependency installs use Bun's isolated linker with the global virtual store enabled, so package contents are shared from Bun's cache and project `node_modules` trees are mostly symlinks.
Turborepo is the canonical root task runner for dev, build, and quality checks, so repeated runs can reuse the `.turbo` cache across workspaces and `--affected` can skip unrelated work.
`bun install` also installs and prewarms the local Git hooks unless `CI` is set. The repo now includes `@effect/tsgo` at the root with the `@effect/language-service` plugin enabled in the main backend and UI tsconfigs, but the binary patch stays opt-in because the upstream tool is still alpha. Use `bun run tsgo:patch` to try the Effect language service binary locally, and `bun run tsgo:unpatch` to restore the stock `@typescript/native-preview` binary.
For VS Code or Cursor, install the `@typescript/native-preview` extension and make sure the native TypeScript server is active so the workspace plugin configuration can load when you opt into `@effect/tsgo`.

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
bun run --cwd apps/backend test src/cloudflare/mcp-miniflare-worker.test.ts
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

This candidate stack is defined in [`alchemy.run.ts`](./alchemy.run.ts) and deploys one Cloudflare `StaticSite` resource that serves the built UI, the Effect HTTP API under `/api/*`, and the MCP HTTP surface under `/mcp`.
The deployed Worker uses both `D1` and `AI` bindings, so the browser app, assistant route, API, and remote MCP server share the same origin and runtime.
Classic stdio MCP is still Bun-only and is not part of the Cloudflare deployment.
The Worker enables native Cloudflare traces/logs.
The assistant path can be wired through an optional Alchemy-managed AI Gateway for model-side metadata and request logging when the deploying Cloudflare profile has AI Gateway permissions.

For passkey auth on the Cloudflare path, optionally set:

```bash
BETTER_AUTH_SECRET=... # optional; Alchemy generates a per-stage secret when omitted
COFFEE_STAFF_USER_IDS=user-id-1,user-id-2 # optional
```

Alchemy uses the v2 Cloudflare state store by default so team and CI deploys share state.
For a disposable local-only state file under `.alchemy/`, set `ALCHEMY_LOCAL_STATE=1`.
The app-owned D1 schema lives in [`packages/domains/coffee/external-sqlite/src/sql/migrations`](./packages/domains/coffee/external-sqlite/src/sql/migrations) and is applied by Alchemy during D1 updates.
Canonical quality commands:

```bash
bun run --cwd apps/backend check
bun run --cwd apps/ui check
bun run check:affected
bun run typecheck
bun run lint
bun run lint:custom
bun run fmt:check
bun run knip
bun run test
bun run check
```

Recommended usage:

- `bun run check` is the full local repo gate.
- `bun run --cwd apps/backend check` and `bun run --cwd apps/ui check` are the app workspace gates.
- `bun run check:affected` is the fast branch-local gate when you want local confidence without paying for the whole repo.
- `bun run build` stays separate from the main quality gate.

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

Hook policy:

- `pre-commit` stays fast and runs format, lint, custom lint, and typecheck.
- `pre-push` runs `bun run check:affected`, which keeps Knip and tests local without putting them on every commit.

Run Storybook from the repo root:

```bash
bun run storybook
bun run build-storybook
```

`bun run storybook` serves the UI stories through Turborepo on port `6006` by default, and `bun run build-storybook` writes the static output to [`apps/ui/storybook-static`](./apps/ui/storybook-static).

## UI

A standalone browser UI lives in [`apps/ui/`](./apps/ui).

Run the backend from the repo root:

```bash
bun run http
```

Then start the frontend:

```bash
bun run --cwd apps/ui dev
```

Run Storybook only for the UI workspace:

```bash
bun run --cwd apps/ui storybook
bun run --cwd apps/ui build-storybook
```

For HTTP-only subdomain-based local development with [`portless`](https://github.com/vercel-labs/portless):

```bash
bun add -g portless

bun run dev:local:api
bun run dev:local:ui
```

This repo runs Portless on a dedicated HTTP-only proxy at port `1365` with an isolated state directory at `/tmp/effect-coffee-shop-portless`, so it does not interfere with any other Portless daemon you already have running.
That serves an in-memory backend with the REST API plus MCP HTTP endpoint on `http://api.coffee.localhost:1365`, and the frontend UI on `http://coffee.localhost:1365`.

This HTTP flow avoids HTTPS trust prompts and does not require `sudo`. It relies on `.localhost` resolution in the browser. It works on Chrome, Firefox, and Edge. Safari may still require host syncing, which Portless documents as a privileged operation.

For the assistant to work against the local Bun backend, set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The deployed Worker uses the Cloudflare `AI` binding instead.

## Cloudflare candidate

This branch includes a candidate Cloudflare deployment scaffold using upstream Alchemy instead of the vendored `alchemy-effect` package.

The current shape is:

- one Alchemy `StaticSite` resource
- `apps/ui/dist` served as static assets
- `/.well-known/agent-configuration` exposed for Better Auth Agent Auth discovery
- `/api/auth/*` handled by Better Auth with passkey registration and sign-in
- `/api/auth/capability/*` and `/api/auth/agent/*` handled by Better Auth Agent Auth
- `/device/capabilities` serves the delegated capability approval UI
- `/api/me` exposes the resolved actor as `anonymous | customer | staff`
- `/api/assistant` handled by a Workers AI-backed Beanline route
- `/api/orders` scoped by authenticated order ownership
- `/api/*` rewritten into the existing Effect `HttpApi`
- `/mcp` handled by the existing MCP HTTP server
- `D1` and `AI` provisioned and bound into the Worker
- app-owned D1 migrations applied from `packages/domains/coffee/external-sqlite/src/sql/migrations`
- optional `AI_GATEWAY_ID` binding when `COFFEE_ASSISTANT_AI_GATEWAY=1` and the Cloudflare profile can manage AI Gateway resources
- `BETTER_AUTH_SECRET` bound into the Worker from the environment or an Alchemy-managed per-stage random secret
- Cloudflare Worker observability enabled with persisted logs/traces

Current observability shape:

- Cloudflare native request, binding, and D1 traces/logs are enabled on the deployed Worker.
- The presentation layer emits structured request logs for `/api/*`, `/api/auth/*`, `/api/assistant`, `/mcp`, and asset fallbacks.
- The assistant route emits run-start, run-finish, run-error, and tool-activity logs.
- Order use cases emit Effect log events annotated with actor and order attributes.
- Better Auth anonymous telemetry stays disabled.
- AI Gateway support is implemented in the assistant runtime, but provisioning is opt-in.

Current limitation:

- The current Cloudflare profile on this machine cannot manage AI Gateway resources, so `COFFEE_ASSISTANT_AI_GATEWAY=1` is not deployable here yet.

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
