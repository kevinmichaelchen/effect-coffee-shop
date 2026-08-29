# Coffee Shop UI

Standalone browser UI for the Coffee Shop backend app workspace in [`../backend`](../backend).

This repo uses Bun workspaces, so install dependencies once from the repo root with `bun install`.

## Stack

- React + Vite
- RetroUI components from `retroui.dev`
- TanStack Query for API state
- Better Auth passkey sign-in for customer and staff workspaces
- strict `oxlint` + `lintcn` + ESLint checks with complexity, function-length, and size limits

## Run it

Start the backend from the repo root:

```bash
bun run http
```

Then start the UI:

```bash
bun run dev
```

The UI runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:3000`.

## Portless Subdomains

Install `portless` globally once:

```bash
bun add -g portless
```

From the repo root, run the in-memory backend on `api.coffee.localhost:1365` in one terminal:

```bash
bun run dev:local:api
```

Run the frontend on `coffee.localhost:1365` in another terminal:

```bash
bun run dev:local:ui
```

This flow keeps Portless on plain HTTP, disables host syncing, and uses an isolated state directory at `/tmp/effect-coffee-shop-portless`, so it does not require `sudo` and does not collide with other Portless setups.
In this mode, the UI still uses `/api/*`, and Vite proxies those requests to `http://api.coffee.localhost:1365`.

## Environment

If you want the UI to call a different backend origin directly, set:

```bash
VITE_COFFEE_API_URL=http://localhost:3000
```

When that variable is unset, the app uses the local Vite proxy at `/api`.

To override only the dev proxy target, set:

```bash
VITE_COFFEE_PROXY_TARGET=http://api.coffee.localhost:1365
```

If you want the local UI to exercise passkey auth through the Bun backend, also set:

```bash
BETTER_AUTH_SECRET=...
```

## Checks

```bash
bun run typecheck
bun run lint
bun run lint:custom
bun run fmt:check
bun run fallow
bun run test
bun run build
```
