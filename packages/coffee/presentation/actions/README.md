# Coffee Actions

`@effect-coffee-shop/coffee-actions` contains the names, descriptions,
input/output schemas, and error schemas of the hand-written Coffee MCP tools: the
menu, order checks, and the ordering context. Order, cart, checkout and staff tools
are generated from the domain Apis instead (see [`coffee-mcp`](../mcp)). It is presentation
support over [`coffee-application`](../../application), not a separate business layer.

- [`src/specs.ts`](./src/specs.ts) defines the tool catalog.
- [`src/schemas.ts`](./src/schemas.ts) defines shared boundary schemas.
- [`coffee-mcp`](../mcp) projects the catalog into Effect tools and connects those
  tools directly to `CoffeeOrderApp`.

Business behavior and authorization belong in the core application. MCP owns
resources, prompts, transports, and execution context. The retired provider and
agent integrations' generic dispatch, custom JSON Schema projection, and result
formatters have been removed.
