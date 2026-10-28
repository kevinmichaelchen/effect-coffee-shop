# Coffee Shop UI

Browser UI for the Coffee Shop. Orders, carts, and the staff queue go through the domain's
`CustomerApi` and `StaffApi` clients; the Coffee Worker in
[`packages/coffee/server`](../../packages/coffee/server) serves them.

This repo uses Bun workspaces, so install dependencies once from the repo root with `bun install`.

## Stack

- [Foldkit](https://foldkit.dev): one `Model`, `Message`s, a pure `update`, and a `view`
  that returns HTML, with Effect doing the work through Commands and Subscriptions
- Vite, Tailwind, and `@foldkit/ui` Dialog Submodels for the receipt, order-details, and
  navigation overlays (focus trap, Escape, scroll lock, and return focus come from Foldkit)
- `alchemy/Domain` Api clients over `Domain.protocolHttp` (Effect RPC) in
  [`src/features/coffee-shop/api/domain-clients.ts`](./src/features/coffee-shop/api/domain-clients.ts)
- Yielded Auth passkey sign-in for customer and staff workspaces
- strict `oxlint` + `lintcn` checks with complexity, function-length, and size limits

## Run it

From the repo root:

```bash
bun run dev
```

This runs `alchemy dev ./infra/alchemy/cloudflare.ts`, which hosts Vite together with the
emulated Coffee Worker. Alchemy prints the local URL. [`src/worker.ts`](./src/worker.ts) is the
Website Worker: it serves the Vite build and forwards `/api`, `/mcp`, `/oauth/`, and
`/.well-known/` to the Coffee Worker over the `COFFEE` service binding, so the app and the Apis
share one origin and the session cookie stays first-party.

When Alchemy hosts Vite (`alchemy dev`, deploys, or `bun run cf:test`), the Vite proxy is
disabled and the Worker owns those paths.

## Environment

Running `vite` on its own (`bun run --cwd apps/ui dev`) proxies `/api`, `/mcp`, `/oauth`, and
`/.well-known` to `VITE_COFFEE_PROXY_TARGET` (default `http://localhost:1337`, the CoffeeWorker port `alchemy dev` uses). Point it at a
running Coffee Worker:

```bash
VITE_COFFEE_PROXY_TARGET=https://your-coffee-worker.example
```

To call a different backend origin directly instead of the same-origin `/api`, set:

```bash
VITE_COFFEE_API_URL=https://your-coffee-worker.example/api
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

## How the app is laid out

| Path                        | Role                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `src/entry.ts`              | Runtime boundary: wires the application and runs it.                                         |
| `src/app/model.ts`          | The single Model, as an Effect Schema.                                                       |
| `src/app/message.ts`        | Every fact the app can learn (clicks, replies, ticks).                                       |
| `src/app/update.ts`         | Pure `(Model, Message) -> Model + Commands`.                                                 |
| `src/app/command.ts`        | Named one-shot effects: viewer, passkey auth, menu, orders, theme.                           |
| `src/app/subscription.ts`   | Four-second order refresh, gated by route and viewer.                                        |
| `src/app/route.ts`          | Bidirectional routes, including the `/control-room`, `/coffee-shop`, and `/login/mcp` paths. |
| `src/app/view/*.ts`         | Views; primitives come from `@effect-coffee-shop/ui-kit`.                                    |
| `src/features/*/api`, `lib` | Api clients and domain helpers; no UI framework imports.                                     |

Live order updates are a refresh Subscription over the existing Api clients. Replacing it with
`@yielded/sync` needs a Sync source and server on the Coffee Worker first, so it is a separate
change; the Subscription is the seam to swap.

## Tests

`bun run test` runs Vitest with Foldkit's `foldkit/story` (update-level tests that dispatch
Messages and resolve Commands) and `foldkit/scene` (update plus view, queried by role, label,
and text, with no browser). The Api and passkey modules are mocked in those tests, so they need
no backend. Add a Story test whenever you add a Message, and a Scene test for new UI.

For passkeys, set `APP_ORIGIN` for the Coffee Worker to the exact UI origin. HTTP development
must use a literal loopback hostname (for example `http://localhost:5173`); named
`.localhost` hosts require HTTPS. The Vite proxy preserves `/api`, `/oauth`, and
`/.well-known` paths. `/login/mcp` serves the same app and returns a successful
sign-in to the fixed OAuth consent path.
