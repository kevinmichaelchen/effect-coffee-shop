# Coffee MCP

`@effect-coffee-shop/coffee-mcp` adapts Coffee application capabilities to MCP.

It defines MCP resources, prompts, tools, and server layers for stdio and HTTP transports. It uses
the neutral action catalog from [`coffee-actions`](../../actions) for tools, while MCP-only
resources and prompts stay in this package.

## FAQ

### What Lives Here?

MCP-specific protocol definitions: resources, prompts, tools, server metadata, and stdio/HTTP MCP
server layers.

### How Do Actions Become MCP Tools?

[`src/action-tools.ts`](./src/action-tools.ts) adapts `CoffeeActionToolkit` from
[`coffee-actions`](../../actions) into MCP tools. The action names, schemas, and neutral action
metadata stay in `coffee-actions`; this package only performs the MCP projection.

### What Is The Difference Between Resources, Prompts, And Tools?

Resources expose readable Coffee state such as menu or order data. Prompts provide reusable MCP
prompt templates. Tools perform actions through
[`CoffeeOrderApp`](../../core/src/application/CoffeeOrderApp.ts), such as listing orders or updating
order status.

### What Does Not Belong Here?

Canonical Coffee action contracts, business rules, database clients, auth session setup, and host
mount routing belong in their owning packages.

## Directory Map

- [`src/action-tools.ts`](./src/action-tools.ts) adapts neutral Coffee actions into MCP tools.
- [`src/resources.ts`](./src/resources.ts) defines menu and order MCP resources.
- [`src/prompts.ts`](./src/prompts.ts) defines recommendation and open-order summary prompts.
- [`src/server.ts`](./src/server.ts) composes MCP features into stdio and HTTP server layers.

## Commands

```bash
bun run --cwd apps/backend mcp:stdio
bun run --cwd apps/backend mcp:http
bun run --cwd packages/coffee/presentation/mcp typecheck
bun run --cwd packages/coffee/presentation/mcp lint
bun run --cwd packages/coffee/presentation/mcp lint:custom
bun run --cwd packages/coffee/presentation/mcp fmt:check
bun run --cwd packages/coffee/presentation/mcp test
```
