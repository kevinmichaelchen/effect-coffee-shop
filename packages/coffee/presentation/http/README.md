# Coffee HTTP

`@effect-coffee-shop/coffee-http` defines the small REST surface that sits beside the domain
Apis: `GET /api/health`, `GET /api/menu` (the static menu, priced in cents) and `GET /api/me`
(who is signed in).

Orders, carts and checkout are not REST endpoints. Clients reach them through the domain's
`CustomerApi` and `StaffApi` (Effect RPC), which the server Worker serves at `/api/customer` and
`/api/staff`. See [`coffee-domain`](../../domain).

## Directory Map

- [`src/api.ts`](./src/api.ts) defines the health, menu and session groups and their handlers.

## Boundary Rule

HTTP paths, response schemas, and handler composition belong here. The request actor is provided
by the server's auth middleware ([`coffee-server`](../../server)).

## Commands

```bash
bun run --cwd packages/coffee/presentation/http typecheck
bun run --cwd packages/coffee/presentation/http lint
bun run --cwd packages/coffee/presentation/http test
```
