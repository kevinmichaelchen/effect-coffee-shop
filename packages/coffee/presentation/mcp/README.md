# Coffee MCP

`@effect-coffee-shop/coffee-mcp` adapts Coffee application capabilities to MCP.

It defines MCP resources, prompts, tools, and the HTTP MCP server layer, which the
[Coffee Worker](../../server) mounts at `/mcp` behind MCP OAuth. It uses
the neutral action catalog from [`coffee-actions`](../actions) for tools, while MCP-only
resources and prompts stay in this package.

## FAQ

### What Lives Here?

MCP-specific protocol definitions: resources, prompts, tools, server metadata, and the HTTP MCP
server layer.

### How Do Actions Become MCP Tools?

[`src/action-toolkit.ts`](./src/action-toolkit.ts) builds Effect AI `Tool`/`Toolkit` definitions
from the neutral action catalog in [`coffee-actions`](../actions).
[`src/action-tools.ts`](./src/action-tools.ts) wires that toolkit to `CoffeeOrderApp`. The action
names, schemas, and neutral action metadata stay in `coffee-actions`; this package performs the MCP
projection.

### What Is The Difference Between Resources, Prompts, And Tools?

Resources expose readable Coffee state such as menu or order data. Prompts provide reusable MCP
prompt templates. Tools perform actions through
[`CoffeeOrderApp`](../../application/src/CoffeeOrderApp.ts), such as listing orders or updating
order status. `CoffeeOrderApp` sends those as commands to the domain model's aggregates and
reads its views.

### What Does Not Belong Here?

Canonical Coffee action contracts, business rules (the domain model), auth session setup, and
Worker routing belong in their owning packages.

## Directory Map

- [`src/action-toolkit.ts`](./src/action-toolkit.ts) projects neutral Coffee actions into Effect AI
  toolkit definitions.
- [`src/action-tools.ts`](./src/action-tools.ts) adapts the toolkit into MCP tools.
- [`src/resources.ts`](./src/resources.ts) defines menu and order MCP resources.
- [`src/prompts.ts`](./src/prompts.ts) defines recommendation and open-order summary prompts.
- [`src/actor.ts`](./src/actor.ts) defines `McpActor`, the per-invocation caller identity.
- [`src/server.ts`](./src/server.ts) composes MCP features into the HTTP server layer.

## Commands

```bash
bun run --cwd packages/coffee/presentation/mcp typecheck
bun run --cwd packages/coffee/presentation/mcp lint
bun run --cwd packages/coffee/presentation/mcp lint:custom
bun run --cwd packages/coffee/presentation/mcp fmt:check
bun run --cwd packages/coffee/presentation/mcp test
```

## Authority and serverless lifetime

HTTP uses Effect's stateless MCP `2026-07-28` transport. The host installs Yielded
OAuth middleware and provides `McpActor`, whose effect resolves the verified grant's
active account and current staff policy **on every invocation**. Tools, resources,
and prompts use that actor; they never substitute a system identity.
Protocol session IDs and client-supplied metadata do not establish application identity.
See [auth configuration](../../auth/README.md) for client registration and signing keys.
