# Coffee Backend

`@effect-coffee-shop/coffee-backend` composes Coffee presentation layers, application layers, auth
context, and request services into backend handlers that runtime packages can host.

## Directory Map

- [`src/app-layer.ts`](./src/app-layer.ts): default persistent Coffee app layer for local backend
  entrypoints.
- [`src/http`](./src/http): Coffee-specific HTTP backend composition over standard Web
  [`Request`/`Response`][mdn-fetch] objects.

## Boundary Rule

This package may compose Coffee backend behavior, but it should not read Bun env, Cloudflare
bindings, AWS Lambda events, or Alchemy deployment resources. Those outer concerns belong in
[`../runtime`](../runtime) and [`../../../infra`](../../../infra).

[mdn-fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
