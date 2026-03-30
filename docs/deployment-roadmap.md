# Deployment Roadmap

## Current state

The scaffold uses in-memory adapters only:

- `MenuRepository`
- `OrderRepository`

That keeps the onion boundaries explicit while the presentation layer is being proven out.

## Planned Cloudflare shape

The intended migration path is:

1. Keep the domain layer unchanged.
2. Keep the service/use-case layer unchanged.
3. Swap only the external adapters.

Likely replacements:

- Cloudflare D1 for the order store.
- Cloudflare Workers for the HTTP API.
- A separate Worker for remote MCP over HTTP.

## Why this scaffold supports that

- HTTP is defined with `HttpApi`, so the contract is already separated from the runtime.
- MCP uses `McpServer.layerHttp`, so the protocol surface is already HTTP-friendly.
- The current repositories are plain Effect services, so replacing in-memory implementations with Cloudflare-backed ones is a layer swap, not a rewrite.

## Alchemy direction

`alchemy-effect` looks like the right place to handle infrastructure provisioning later, not application behavior now.

That suggests:

- Keep app code in this repo under `src/`.
- Add deployment stacks later under a separate infra entrypoint.
- Reuse the same application layer in both local Bun and Cloudflare deployments.
