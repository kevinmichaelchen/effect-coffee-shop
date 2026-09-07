# Coffee Actions

`@effect-coffee-shop/coffee-actions` contains the Coffee tool names, descriptions,
input/output schemas, and error schemas used by Effect MCP. It is presentation
support over [`coffee-core`](../../core), not a separate business layer.

- [`src/specs.ts`](./src/specs.ts) defines the tool catalog.
- [`src/schemas.ts`](./src/schemas.ts) defines shared boundary schemas.
- [`coffee-mcp`](../mcp) projects the catalog into Effect tools and connects those
  tools directly to `CoffeeOrderApp`.

Business behavior and authorization belong in the core application. MCP owns
resources, prompts, transports, and execution context. The retired provider and
agent integrations' generic dispatch, custom JSON Schema projection, and result
formatters have been removed.
