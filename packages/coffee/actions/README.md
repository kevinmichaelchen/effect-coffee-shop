# Coffee Actions

`@effect-coffee-shop/coffee-actions` is the neutral Coffee capability contract package.

It sits at the application/presentation boundary:

- It depends inward on `coffee-core` domain and application contracts.
- It defines shared action names, descriptions, schemas, JSON input metadata, execution helpers, and presentation-neutral formatting.
- It does not depend on HTTP, MCP, assistant runtimes, Better Auth, Cloudflare, Bun, Node, or external adapter packages.

Presentation packages adapt these neutral actions into their own transport or runtime format. For example, MCP turns them into Effect MCP tools, the assistant turns them into Workers AI tool definitions, and auth turns them into Agent Auth capabilities.

## Directory Map

- `src/specs.ts` defines canonical Coffee action specs.
- `src/schemas.ts` defines shared Effect schemas and decoders.
- `src/json-schema.ts` defines runtime-neutral JSON object schemas for tool/capability adapters.
- `src/execute.ts` maps action names to `CoffeeOrderApp` use cases.
- `src/format.ts` contains shared text formatting for tool/capability results.

## Boundary Rule

If a type comes from a delivery/runtime SDK, it belongs in the consuming presentation or auth package, not here.
