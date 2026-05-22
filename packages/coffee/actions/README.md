# Coffee Actions

`@effect-coffee-shop/coffee-actions` is the neutral Coffee capability adapter package.

## What Is An Action?

An action is a presentation-safe handle for a Coffee application use case. The application layer in
`coffee-core` remains the source of truth for domain types, business rules, authorization, and
Effect-based use case functions. This package does not add another business layer.

What it adds is a stable adapter contract for surfaces that cannot directly expose
`CoffeeOrderApp` methods: action names, descriptions, boundary schemas, JSON input metadata,
presentation-neutral result formatting, and dispatch from an action name to the underlying
application use case.

That keeps MCP, the assistant, and Agent Auth from each inventing their own version of `list_menu`,
`place_order`, or `checkout_cart`. They all adapt this same neutral action catalog into their own
protocols, while the actual behavior stays in `coffee-core/application`.

It sits at the application/presentation boundary:

- It depends inward on `coffee-core` domain and application contracts.
- It defines shared action names, descriptions, schemas, JSON input metadata, execution helpers, and presentation-neutral formatting.
- It does not depend on HTTP, MCP, assistant runtimes, Better Auth, Cloudflare, Bun, Node, or external adapter packages.

Presentation packages adapt these neutral actions into their own transport or runtime format. For example, MCP turns them into Effect MCP tools, the assistant turns them into provider-neutral AI tools, and auth turns them into Agent Auth capabilities.

## Directory Map

- `src/specs.ts` defines canonical Coffee action specs.
- `src/schemas.ts` defines shared Effect schemas and decoders.
- `src/json-schema.ts` defines runtime-neutral JSON object schemas for tool/capability adapters.
- `src/execute.ts` maps action names to `CoffeeOrderApp` use cases.
- `src/format.ts` contains shared text formatting for tool/capability results.

## Boundary Rule

If a type comes from a delivery/runtime SDK, it belongs in the consuming presentation or auth package, not here.
