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

### Where Do The Tools Come From?

Two places:

- **Generated from the domain Apis.** [`src/domain-tools.ts`](./src/domain-tools.ts) serves
  `CustomerApi` and `StaffApi` with `DomainAi.toMcp`: one tool per command
  (`CustomerApi_PlaceOrder_send`) and per read (`CustomerApi_Cart_get`). Each call runs through the
  Api's own `Session` middleware and the command's `decide` or the read's `validate`, with the
  OAuth-resolved `McpActor` sent as the actor header. A rejection (`Unauthorized`, `NotYourCart`,
  `StaffOnly`, ...) comes back as the tool's result. A command's description is its
  `description` option in the domain.
- **Hand-written.** [`src/action-toolkit.ts`](./src/action-toolkit.ts) and
  [`src/action-tools.ts`](./src/action-tools.ts) serve what the Apis do not: the menu
  (`list_menu`, `get_item_options`), checks of a proposed order (`validate_order`, `quote_order`),
  and `get_ordering_context`, which tells an agent the signed-in customer's id and hands it fresh
  ids for new orders, cart lines and checkouts. Their names and schemas live in
  [`coffee-actions`](../actions).

### Who Sees The Staff Tools?

[`src/visibility.ts`](./src/visibility.ts) lists the generated `StaffApi_*` tools only to staff.
That is presentation: the Api still authorizes every call, so a hidden tool called anyway is
refused.

### What Is The Difference Between Resources, Prompts, And Tools?

Resources expose readable Coffee state such as menu or order data. Prompts provide reusable MCP
prompt templates. Tools perform actions: the generated ones through the domain Apis, the
hand-written ones through [`CoffeeOrderApp`](../../application/src/CoffeeOrderApp.ts).

### What Does Not Belong Here?

Canonical Coffee action contracts, business rules (the domain model), auth session setup, and
Worker routing belong in their owning packages.

## Directory Map

- [`src/domain-tools.ts`](./src/domain-tools.ts) generates the order, cart, checkout and staff
  tools from `CustomerApi` and `StaffApi`.
- [`src/action-toolkit.ts`](./src/action-toolkit.ts) projects the hand-written Coffee actions into
  Effect AI toolkit definitions.
- [`src/action-tools.ts`](./src/action-tools.ts) adapts that toolkit into MCP tools.
- [`src/visibility.ts`](./src/visibility.ts) hides the staff tools from everyone else.
- [`src/resources.ts`](./src/resources.ts) defines menu and order MCP resources.
- [`src/prompts.ts`](./src/prompts.ts) defines recommendation and open-order summary prompts.
- [`src/skills.ts`](./src/skills.ts) publishes the ordering workflow through the MCP Skills
  extension (SEP-2640), including cart review and confirmed checkout. Clients opt in with
  `extensions: { skills: true }`; the skill is also a readable MCP resource.
- [`src/actor.ts`](./src/actor.ts) defines `McpActor`, the per-invocation caller identity.
- [`src/server.ts`](./src/server.ts) composes MCP features into the HTTP server layer.

## Commands

```bash
bun run --cwd packages/coffee/presentation/mcp typecheck
bun run --cwd packages/coffee/presentation/mcp lint
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
