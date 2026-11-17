# Coffee MCP

`@effect-coffee-shop/coffee-mcp` adapts Coffee application capabilities to MCP: resources, prompts,
tools, and the HTTP MCP server layer that the [Coffee Worker](../../server) mounts at `/mcp` behind MCP
OAuth. Tools come either generated from the domain Apis or from the neutral catalog in
[`coffee-actions`](../actions).

<details>
<summary>Where do the tools come from?</summary>

Two places:

- **Generated from the domain Apis.** [`src/domain-tools.ts`](./src/domain-tools.ts) serves
  `CustomerApi` and `StaffApi` with `DomainAi.toMcp`: one tool per listed command
  (`CustomerApi_PlaceOrder_send`) and view read (`CustomerApi_CustomerCart_get`). Each call runs
  through the Api's own `Session` middleware and the command's `decide` or the view's guard Layer,
  with the OAuth-resolved `McpActor` sent as the actor header. A rejection (`Unauthorized`,
  `NotYourCart`, `StaffOnly`, ...) comes back as the tool's result. A command's description is its
  `description` annotation in the domain.
- **Hand-written.** [`src/action-toolkit.ts`](./src/action-toolkit.ts) and
  [`src/action-tools.ts`](./src/action-tools.ts) serve what the Apis do not: the menu (`list_menu`,
  `get_item_options`), checks of a proposed order (`validate_order`, `quote_order`), and
  `get_ordering_context`, which tells an agent the signed-in customer's id and hands it fresh ids for
  new orders, cart lines and checkouts. Their names and schemas live in
  [`coffee-actions`](../actions), and they run through
  [`CoffeeOrderApp`](../../application/src/CoffeeOrderApp.ts).

</details>

<details>
<summary>What lives where</summary>

- [`src/domain-tools.ts`](./src/domain-tools.ts) generates the order, cart, checkout and staff tools
  from `CustomerApi` and `StaffApi`.
- [`src/action-toolkit.ts`](./src/action-toolkit.ts) projects the hand-written Coffee actions into
  Effect AI toolkit definitions.
- [`src/action-tools.ts`](./src/action-tools.ts) adapts that toolkit into MCP tools.
- [`src/visibility.ts`](./src/visibility.ts) lists the generated `StaffApi_*` tools only to staff.
  That is presentation: the Api still authorizes every call, so a hidden tool called anyway is
  refused.
- [`src/resources.ts`](./src/resources.ts) defines menu and order MCP resources.
- [`src/prompts.ts`](./src/prompts.ts) defines recommendation and open-order summary prompts.
- [`src/skills.ts`](./src/skills.ts) publishes the ordering workflow through the MCP Skills extension
  (SEP-2640), including cart review and confirmed checkout. Clients opt in with `extensions: { skills:
  true }`; the skill is also a readable MCP resource.
- [`src/actor.ts`](./src/actor.ts) defines `McpActor`, the per-invocation caller identity.
- [`src/server.ts`](./src/server.ts) composes MCP features into the HTTP server layer.

Resources expose readable Coffee state such as menu or order data; prompts provide reusable MCP prompt
templates; tools perform actions. Canonical Coffee action contracts, business rules (the domain
model), auth session setup, and Worker routing belong in their owning packages.

```bash
bun run --cwd packages/coffee/presentation/mcp lint
bun run --cwd packages/coffee/presentation/mcp fmt:check
bun run --cwd packages/coffee/presentation/mcp test
```

</details>

<details>
<summary>Authority and serverless lifetime</summary>

HTTP uses Effect's stateless MCP `2026-07-28` transport. The host installs Yielded OAuth middleware and
provides `McpActor`, whose effect resolves the verified grant's active account and current staff
policy **on every invocation**. Tools, resources, and prompts use that actor; they never substitute a
system identity. Protocol session IDs and client-supplied metadata do not establish application
identity. See [auth configuration](../../auth/README.md) for client registration and signing keys.

</details>
