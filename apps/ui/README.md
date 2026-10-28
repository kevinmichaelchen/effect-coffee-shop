# Coffee Shop UI

Browser UI for the Coffee Shop. Orders, carts, and the staff queue go through the domain's
`CustomerApi` and `StaffApi` clients; the Coffee Worker in
[`packages/coffee/server`](../../packages/coffee/server) serves them.

This repo uses Bun workspaces, so install dependencies once from the repo root with `bun install`.

## Stack

- React + Vite
- RetroUI components from `retroui.dev`
- TanStack Query for API state
- `@alchemy.run/domain` Api clients over `Domain.protocolHttp` (Effect RPC) in
  [`src/features/coffee-shop/api/domain-clients.ts`](./src/features/coffee-shop/api/domain-clients.ts)
- Yielded Auth passkey sign-in for customer and staff workspaces
- strict `oxlint` + `lintcn` + ESLint checks with complexity, function-length, and size limits

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

## Storybook workshop

Run `bun run storybook` from the repository root and open `http://localhost:6006`.
Stories run locally with fixed sample data and callback spies; no backend or
passkey registration is needed. Use the toolbar to switch light/dark themes and
mobile/tablet/desktop viewports. The `Mobile` stories pin the narrow viewport.

Useful starting points:

- **Coffee Shop / Screens / BaristaWorkflow / Playground**: start, ready, pick up,
  or cancel tickets. Inspect tickets in the drawer and find closed tickets in
  recent activity. Remount the story to reset the local queue.
- **Coffee Shop / Customer / OrderComposerCard**: change drinks and customizations,
  inspect tea constraints, edit quantities and notes, and try the pending state.
  Submission is a spy visible in Storybook; it does not create a real order.
- **Coffee Shop / Customer / ReceiptDialog**: single/group receipts, long names,
  mobile layout, navigation, dismissal, and reopening.
- **Coffee Shop / Barista**: empty/busy queues, updates scoped to one ticket,
  status-specific drawer actions, and recent activity.
- **Coffee Shop / Customer / CustomerOrdersPanel**: first visit, active/history
  tickets, and background refreshing with existing content retained.
- **Auth / Passkey** and **Auth / Session**: registration/sign-in callbacks,
  pending and error states, customer/staff identities, and mobile examples.

Stories with `play` functions demonstrate and assert interactions automatically;
the Interactions panel shows their steps. Use `bun run test:storybook` to run
all stories in Chromium in both themes, or `bun run build-storybook` to build the
static workshop. Shared field stories also verify that inputs can be found by
their visible labels.

For passkeys, set `APP_ORIGIN` for the Coffee Worker to the exact UI origin. HTTP development
must use a literal loopback hostname (for example `http://localhost:5173`); named
`.localhost` hosts require HTTPS. The Vite proxy preserves `/api`, `/oauth`, and
`/.well-known` paths. `/login/mcp` serves the same app and returns a successful
sign-in to the fixed OAuth consent path.
