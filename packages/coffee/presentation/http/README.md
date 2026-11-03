# Coffee HTTP

`@effect-coffee-shop/coffee-http` defines the Worker's REST surfaces:

- `GET /api/health`, `GET /api/menu` (the static menu, priced in cents) and `GET /api/me` (who is
  signed in), hand-written in [`src/api.ts`](./src/api.ts).
- The domain's `CustomerApi` and `StaffApi` as REST under `/api/rest/customer` and
  `/api/rest/staff`, generated from the Apis with `DomainHttp.toHttpApi` in
  [`src/domain-rest.ts`](./src/domain-rest.ts), with an OpenAPI document at
  `/api/rest/openapi.json`. A command is `POST /<Command>` with `{ target, input, commandId? }`; a
  read is `GET /<View>/:key` (and `/snapshot`, `/list`, and Server-Sent Events at `/watch` and
  `/events`). A rejection answers with its `_tag` at the status its `httpApiStatus` gives it.
  Each endpoint's OpenAPI description is its command's `description`, or what the read returns.

### Who can call the REST endpoints?

The Worker serves them behind the same auth session as the app's Domain RPC: the caller is whoever
their session cookie says, never an actor header they send. Writes (`POST`) must also carry an
`Origin` of the app itself, and bearer tokens are refused. So today REST serves the app's own pages
and scripts running with a signed-in browser session; agents and other programs use MCP, which
authenticates with OAuth.

The Foldkit UI keeps using the same Apis over Effect RPC at `/api/customer` and `/api/staff`. Every
transport runs the Apis' own `Session` middleware and checks, so they authorize alike. See
[`coffee-domain`](../../domain).

## Directory Map

- [`src/api.ts`](./src/api.ts) defines the health, menu and session groups and their handlers.
- [`src/domain-rest.ts`](./src/domain-rest.ts) generates REST from the domain Apis. It trusts the
  actor header, so the Worker mounts it only behind its auth session (`domainApi`), which replaces
  any copy a client sent.

## Boundary Rule

HTTP paths, response schemas, and handler composition belong here. The request actor is provided
by the server's auth middleware ([`coffee-server`](../../server)).

## Commands

```bash
bun run --cwd packages/coffee/presentation/http typecheck
bun run --cwd packages/coffee/presentation/http lint
bun run --cwd packages/coffee/presentation/http test
```
