# Coffee Core

`@effect-coffee-shop/coffee-core` is the Coffee bounded-context core.

It owns the domain model, application use cases, application service tags, ports, errors, actor
model, observability names, and repository contract helpers. It does not own transport protocols,
runtime SDKs, database clients, assistant providers, or deployment wiring.

## Architecture

- [`src/domain`](./src/domain): pure Coffee concepts such as menu items, money, orders, carts,
  checkout sessions, and domain errors.
- [`src/application/use-cases`](./src/application/use-cases): Effect use cases that enforce business
  rules and actor access.
- [`src/application/ports`](./src/application/ports): persistence and id-generator ports required by
  use cases.
- [`src/application/CoffeeOrderApp.ts`](./src/application/CoffeeOrderApp.ts): service facade that
  wires use cases behind one application service.
- [`src/application/CurrentActor.ts`](./src/application/CurrentActor.ts): request actor model and
  authorization errors.
- [`src/application/contracts.ts`](./src/application/contracts.ts): boundary schemas and view models
  shared by adapters.
- [`src/application/testing`](./src/application/testing): reusable repository contract tests for
  external adapters.

## FAQ

### What Belongs In Core?

Business behavior that should be true regardless of HTTP, MCP, CLI, assistant, database, or runtime.
If changing code here changes what Coffee orders mean or how Coffee workflows behave, it likely
belongs in core.

### What Does Not Belong In Core?

HTTP routes, MCP resources, assistant prompts, Agent Auth metadata, Better Auth setup, database
client code, Cloudflare bindings, Bun servers, and AWS Lambda handlers belong outside core. See the
[`presentation`](../presentation), [`assistant`](../assistant), [`auth`](../auth), and
[`external`](../external) package groups for those concerns.

### Where Do External Inputs Get Decoded?

Decode external input at the boundary with Effect schemas. Core may define schemas and typed
contracts, but presentation and runtime packages decide how HTTP payloads, MCP arguments, auth
sessions, and environment bindings enter the system.

## Commands

```bash
bun run --cwd packages/coffee/core typecheck
bun run --cwd packages/coffee/core lint
bun run --cwd packages/coffee/core lint:custom
bun run --cwd packages/coffee/core fmt:check
bun run --cwd packages/coffee/core test
```
