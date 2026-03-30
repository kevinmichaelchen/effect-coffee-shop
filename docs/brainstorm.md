# Coffee Order App Brainstorm

## Effect v4 conventions to follow

These came directly from the vendored `effect-smol` repo:

- Model capabilities as `ServiceMap.Service` classes.
- Build implementations with `Layer.succeed`, `Layer.sync`, or `Layer.effect`.
- Write effectful operations with `Effect.fn("name")(...)`.
- Keep small internal helpers on `Effect.fnUntraced(...)`.
- Define structured errors with `Schema.TaggedErrorClass`.
- Define the HTTP surface once with `HttpApi`, `HttpApiGroup`, and `HttpApiEndpoint`.
- Implement HTTP groups with `HttpApiBuilder.group(...)`.
- Build CLI commands with `Command.make(...)` and `Command.withHandler(...)`.
- Build MCP tools with `Tool.make(...)`, `Toolkit.make(...)`, and `McpServer.toolkit(...)`.

## Onion mapping

### Domain layer

Pure business concepts. Minimal or no dependency on Effect runtime concerns.

Candidate domain types:

- `OrderId`
- `Drink`
- `DrinkSize`
- `Milk`
- `Temperature`
- `OrderStatus`
- `Money`
- `CustomerName`
- `CoffeeOrder`

Candidate domain rules:

- Espresso drinks can have extra shots.
- Tea cannot have espresso shots.
- Cold drinks cannot be marked as extra hot.
- An order can only move forward through valid status transitions.

### Service layer

Application use cases and ports. This is where Effect services should dominate.

Candidate ports:

- `OrderRepository`
- `MenuRepository`
- `IdGenerator`
- `Clock`
- `Notifier`

Candidate use cases:

- `PlaceOrder`
- `GetOrder`
- `ListOrders`
- `StartBrewing`
- `MarkReady`
- `PickUpOrder`
- `CancelOrder`

This layer should be presentation-agnostic. HTTP, CLI, and MCP should all call these same use cases.

### Presentation layer

Three adapters over the same service layer.

HTTP:

- Define an `HttpApi` for menu and order workflows.
- Generate OpenAPI docs automatically.
- Optionally derive a typed client for integration tests.

CLI:

- `coffee order create`
- `coffee order get <id>`
- `coffee order list`
- `coffee barista start <id>`
- `coffee barista ready <id>`
- `coffee order pickup <id>`

MCP:

- Tools:
  - `place_order`
  - `get_order`
  - `list_orders`
  - `start_brewing`
  - `mark_ready`
  - `pick_up_order`
- Resources:
  - `coffee://menu`
  - `coffee://orders/{id}`
  - `coffee://orders/open`
- Prompts:
  - `recommend-drink`
  - `summarize-open-orders`

### External layer

Concrete adapters and runtime wiring.

Candidate live implementations:

- In-memory repositories for the first iteration.
- Bun HTTP server via `@effect/platform-bun`.
- Bun stdio for CLI and MCP stdio transport.
- Optional MCP-over-HTTP route for remote clients.

## Recommended first slice

Build a thin but end-to-end vertical slice around the order lifecycle.

Include:

- Menu with 4-6 drinks.
- Order creation with a few customization options.
- Order retrieval by id.
- Open-order listing.
- Status transitions:
  - `Pending`
  - `Brewing`
  - `Ready`
  - `PickedUp`
  - `Cancelled`

Avoid for v1:

- Payments
- User accounts
- Real database
- Inventory depletion
- Authentication

That keeps the onion honest without burying the first iteration in infrastructure.

## Recommended HTTP surface

- `GET /health`
- `GET /menu`
- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/start-brewing`
- `POST /orders/:id/mark-ready`
- `POST /orders/:id/pick-up`
- `POST /orders/:id/cancel`

## Recommended CLI surface

- `coffee menu list`
- `coffee order create --drink latte --size large --milk oat --shots 2`
- `coffee order get <order-id>`
- `coffee order list --status ready`
- `coffee barista start <order-id>`
- `coffee barista ready <order-id>`
- `coffee order pickup <order-id>`

## Recommended MCP surface

Expose the same service-layer operations with MCP tools and add a small amount of read-focused context:

- Tools for command-like actions.
- Resources for menu and order state.
- Prompts for guided agent workflows.

This gives LLM clients both imperative operations and contextual reads without duplicating domain logic.

## Suggested project shape

```text
src/
  domain/
    order.ts
    menu.ts
    errors.ts
  service/
    ports/
      order-repository.ts
      menu-repository.ts
    use-cases/
      place-order.ts
      get-order.ts
      list-orders.ts
      start-brewing.ts
      mark-ready.ts
      pick-up-order.ts
  presentation/
    http/
      api.ts
      handlers.ts
      server.ts
    cli/
      command.ts
    mcp/
      toolkit.ts
      resources.ts
      prompts.ts
      server.ts
  external/
    in-memory/
      in-memory-order-repository.ts
      in-memory-menu-repository.ts
    bun/
      runtime.ts
  main.ts
```

## Recommendation

The best first implementation is:

1. In-memory coffee order workflow.
2. One shared service layer.
3. Three presentations over that shared layer: HTTP, CLI, MCP.
4. Bun as the only runtime.

That is small enough to finish quickly and large enough to prove the onion boundaries.
