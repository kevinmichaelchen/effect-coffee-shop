# Backend HTTP Wiring

This directory holds Coffee-specific HTTP wiring shared by runtime adapters in
[`../../../runtime`](../../../runtime). It is where Coffee application layers, auth context, and protocol
handlers are adapted to standard Web [`Request` and `Response`][mdn-fetch] objects.

## Nomenclature

| Name             | Meaning                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `backend.ts`     | Composes browser auth, OAuth/MCP, and the API in one scoped request graph. |
| `direct-auth.ts` | Applies direct HTTP auth rules before app routes handle a request.         |

`http` means product-level HTTP composition. Generic route dispatch, logging, request services, and
observability live in [`@effect-coffee-shop/http-routing`](../../../../http-routing), which is kept
Coffee-agnostic.

## Boundary Rule

Keep platform details out of this directory. Bun, Cloudflare, and AWS bindings belong in
[`../../../runtime`](../../../runtime); Coffee domain behavior belongs in
[`../../../application`](../../../application).

[mdn-fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
