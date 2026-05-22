# Coffee Actions

`@effect-coffee-shop/coffee-actions` is the neutral Coffee capability adapter package.

## FAQ

### What Is A Coffee Action?

An action is a presentation-safe handle for a Coffee application use case. The application layer in
[`coffee-core`](../core) remains the source of truth for domain types, business rules,
authorization, and Effect-based use case functions. This package does not add another business
layer.

### Why Does This Package Exist If `coffee-core/application` Already Has Use Cases?

What it adds is a stable adapter contract for surfaces that cannot directly expose
[`CoffeeOrderApp`](../core/src/application/CoffeeOrderApp.ts) methods: action names, descriptions,
boundary schemas, JSON input metadata, presentation-neutral result formatting, and dispatch from an
action name to the underlying application use case.

That keeps MCP, the assistant, and Agent Auth from each inventing their own version of `list_menu`,
`place_order`, or `checkout_cart`. They all adapt this same neutral action catalog into their own
protocols, while the actual behavior stays in
[`coffee-core/application`](../core/src/application).

### Is This An MCP Package?

No. MCP is one consumer of these action contracts, but this package does not define MCP resources,
prompts, servers, transports, or SDK-specific tool wiring. MCP-specific adaptation belongs in
[`packages/coffee/presentation/mcp`](../presentation/mcp).

### What Belongs Here?

It sits at the application/presentation boundary:

- It depends inward on [`coffee-core`](../core) domain and application contracts.
- It defines shared action names, descriptions, schemas, JSON input metadata, execution helpers, and
  presentation-neutral formatting.
- It does not depend on HTTP, MCP, assistant runtimes, Better Auth, Cloudflare, Bun, Node, or
  external adapter packages.

Presentation packages adapt these neutral actions into their own transport or runtime format. For
example, [`coffee-mcp`](../presentation/mcp) turns them into Effect MCP tools,
[`coffee-assistant`](../assistant) turns them into provider-neutral AI tools, and
[`coffee-auth`](../auth) turns them into Agent Auth capabilities.

### What Does Not Belong Here?

Runtime SDK types, transport concerns, authentication session handling, model-provider details, HTTP
route definitions, MCP resources, and UI display state belong in the package that owns that surface.

### When Should I Add A New Action?

Add an action when an existing Coffee application use case needs a stable external capability shape
shared by more than one presentation or capability surface. If only one surface needs a private
helper, keep that helper in the surface package.

### When Should I Change `coffee-core` Instead?

Change [`coffee-core`](../core) when the business behavior, domain model, authorization rule,
persistence port, or Effect use case contract changes. Then update this package only to expose the
new or changed application behavior to external adapters.

## Directory Map

- [`src/specs.ts`](./src/specs.ts) defines canonical Coffee action specs.
- [`src/schemas.ts`](./src/schemas.ts) defines shared Effect schemas and decoders.
- [`src/json-schema.ts`](./src/json-schema.ts) defines runtime-neutral JSON object schemas for
  tool/capability adapters.
- [`src/execute.ts`](./src/execute.ts) maps action names to `CoffeeOrderApp` use cases.
- [`src/format.ts`](./src/format.ts) contains shared text formatting for tool/capability results.

## Boundary Rule

If a type comes from a delivery/runtime SDK, it belongs in the consuming presentation or auth package,
not here.
