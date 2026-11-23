# Coffee HTTP

`@effect-coffee-shop/coffee-http` defines the Worker's REST surfaces: `GET /api/health`, `GET
/api/menu` (the static menu, priced in cents), `GET /api/me` (who is signed in), and the domain's
`CustomerApi` and `StaffApi` generated as REST under `/api/rest/*` with an OpenAPI document.

<details>
<summary>What lives where</summary>

- [`src/api.ts`](./src/api.ts) defines the health, menu and session groups and their handlers.
- [`src/domain-rest.ts`](./src/domain-rest.ts) generates REST from the domain Apis with
  `DomainHttp.toHttpApi`, including the OpenAPI document at `/api/rest/openapi.json`. It trusts the
  actor header, so the Worker mounts it only behind its auth session (`domainApi`), which replaces any
  copy a client sent.

A command is `POST /<Command>` with `{ input, commandId? }`; the ID belongs in `input`. A read is `GET /<View>/:key` (and
`/snapshot`, `/list`, and Server-Sent Events at `/watch` and `/events`). A rejection answers with its
`_tag` at the status its `httpApiStatus` gives it. Each endpoint's OpenAPI description is its
command's `description`, or its view's.

</details>

<details>
<summary>Who can call the REST endpoints?</summary>

The Worker serves them behind the same auth session as the app's Domain RPC: the caller is whoever
their session cookie says, never an actor header they send. Writes (`POST`) must also carry an
`Origin` of the app itself, and bearer tokens are refused. So REST serves the app's own pages and
scripts running with a signed-in browser session; agents and other programs use MCP, which
authenticates with OAuth.

The Foldkit UI keeps using the same Apis over Effect RPC at `/api/customer` and `/api/staff`. Every
transport runs the Apis' own `Session` middleware and checks, so they authorize alike. See
[`coffee-domain`](../../domain).

This package says nothing about the platform: paths, response schemas, and handler composition belong
here, and the request actor comes from the server's auth middleware
([`coffee-server`](../../server)).

```bash
bun run --cwd packages/coffee/presentation/http lint
bun run --cwd packages/coffee/presentation/http test
```

</details>
