# Coffee Shop UI

Foldkit renders the customer and barista workspaces. Yielded Auth provides passkey
registration and sign-in. Yielded Sync delivers private customer order feeds and
the staff queue over scoped WebSocket connections. Domain commands retain the
server's durable order and checkout workflows.

Run `bun run dev` from the root for Alchemy's local Website and Coffee Workers.
For a standalone Vite server, set `VITE_COFFEE_PROXY_TARGET` to the Coffee Worker
(default `http://localhost:1337`). The Website Worker forwards `/api`, `/sync/`,
`/mcp`, `/oauth/`, and `/.well-known/` to the backend on the same origin.

Set `APP_ORIGIN` to the exact UI origin. Passkeys require HTTPS except on literal
loopback hosts. `/login/mcp` returns successful sign-in to OAuth consent.

Run `bun run --cwd apps/ui check` for types, lint, formatting, Foldkit tests, and
the production build.

Official references: [Foldkit](https://foldkit.dev),
[Yielded Sync](https://yielded.dev/sync/), [Yielded Auth](https://yielded.dev/auth/).
