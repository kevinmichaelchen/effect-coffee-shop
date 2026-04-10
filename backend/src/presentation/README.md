# Presentation Layer

This directory is larger than a typical "controllers only" presentation layer on purpose.

It is the place where one coffee-order service is projected into multiple external surfaces:

- REST HTTP for the app API
- a server-side assistant route for the UI
- MCP over HTTP
- MCP over stdio
- a CLI
- Cloudflare Worker and local Bun entrypoints

If this looks like "adapter sprawl", that instinct is partly right. The important distinction is:

- Some of this code is durable presentation logic we really need.
- Some of it exists because current library and platform seams do not line up cleanly.

This README is a map of both.

## What This Layer Owns

The domain and service layers stay transport-agnostic.

`presentation/` is responsible for:

- decoding and validating boundary input
- shaping service results for a specific protocol
- wiring one service surface into multiple transports
- handling protocol quirks that should not leak into domain code
- testing boundary behavior where regressions are most likely

It should **not** own business rules, persistence policy, or domain modeling.

Those live elsewhere:

- domain types and errors in `#domain/*`
- application use cases in `#service/*`
- runtime and storage wiring in `#runtime/*` and `#external/*`

## Why There Is More Code Than Expected

The short version is that we are not exposing "one API". We are exposing the same coffee shop through five different protocols, each with different expectations:

1. REST wants request/response endpoints and typed HTTP errors.
2. The assistant wants chat messages, tool calls, and SSE events.
3. MCP wants tools, resources, prompts, JSON-RPC, and both stdio and HTTP transport.
4. Cloudflare wants a single Worker entrypoint and platform bindings.
5. Local development wants Bun entrypoints and a path that works without Cloudflare bindings.

If this directory were smaller, one of two things would be happening:

- protocol-specific concerns would be leaking into the service layer, or
- boundary behavior would be implicit and much harder to reason about.

## Directory Survey

### `http/`

- [api.ts](./http/api.ts): Defines the public REST API shape using Effect `HttpApi`, including endpoint schemas and error projections.
- [bun-server.ts](./http/bun-server.ts): Starts the local Bun server and mounts the assistant route for non-Cloudflare runs.
- [main.ts](./http/main.ts): Minimal local REST entrypoint.
- [web-handler.ts](./http/web-handler.ts): Shared "turn a layered Effect router into a web handler" adapter used by Bun and Cloudflare.
- [api.test.ts](./http/api.test.ts): Boundary tests for REST behavior.

Why this exists:

- REST needs endpoint-local schemas and HTTP-specific error shaping.
- We want one reusable web handler for Bun and Cloudflare instead of forking the whole stack.

### `assistant/`

- [handler.ts](./assistant/handler.ts): `/api/assistant` boundary. Decodes request bodies, starts the run, and emits SSE back to the UI.
- [runtime.ts](./assistant/runtime.ts): Runs the Workers AI conversation loop, including tool-call rounds and model selection.
- [tools.ts](./assistant/tools.ts): Exposes coffee shop actions as assistant-callable tools and emits tool activity for the UI.
- [tool-data.ts](./assistant/tool-data.ts): Tool parameter schemas and decoders.
- [tool-format.ts](./assistant/tool-format.ts): Human-readable formatting for tool payloads and failures.
- [chunks.ts](./assistant/chunks.ts): Internal event queue and the chunk shapes we send over SSE.
- [rest.ts](./assistant/rest.ts): Local Bun fallback for Workers AI over the Cloudflare REST API when a native Worker binding is unavailable.
- [handler.test.ts](./assistant/handler.test.ts): Regression tests for assistant request decoding and streaming behavior.

Why this exists:

- The UI sends TanStack chat messages, but Workers AI expects a different message format.
- The assistant must use the same underlying `CoffeeOrderApp` service without exposing REST or MCP directly.
- The UI wants progress updates during tool use, not only a final answer.
- Local Bun runs need an account/token REST path, while Cloudflare deploys use the in-process `env.AI` binding.

This is one of the main places where the layer feels "adapter-heavy". That is real. The cost comes from bridging:

- TanStack AI client message shapes
- our own assistant event stream
- Workers AI request/response shapes
- coffee service methods

### `auth/`

- [server.ts](./auth/server.ts): Better Auth setup for passkeys, session resolution, D1 persistence bootstrap, and Cloudflare request integration.
- [agent-auth.ts](./auth/agent-auth.ts): Better Auth Agent Auth capability definitions and the execution bridge from delegated agent calls into `CoffeeOrderApp`.
- [server.test.ts](./auth/server.test.ts): Passkey registration regression coverage.
- [agent-auth.test.ts](./auth/agent-auth.test.ts): Delegated capability execution coverage against the D1-backed app wiring.

Why this exists:

- passkey auth, session cookies, and staff/customer actor resolution are presentation-boundary concerns
- Agent Auth adds another public protocol surface with discovery, approval, and capability execution
- Better Auth needs Cloudflare-specific setup and persistence bootstrapping that should not leak into the domain or service layers

### `mcp/`

- [server.ts](./mcp/server.ts): Assembles the MCP server surface.
- [actions.ts](./mcp/actions.ts): Shared MCP action specs for tool names, schemas, and success/failure contracts.
- [action-tools.ts](./mcp/action-tools.ts): Projects service methods into MCP tools.
- [resources.ts](./mcp/resources.ts): Projects service data into MCP resources.
- [prompts.ts](./mcp/prompts.ts): MCP prompt templates.
- [schemas.ts](./mcp/schemas.ts): Shared MCP-facing schemas.
- [stdio-main.ts](./mcp/stdio-main.ts): stdio transport entrypoint.
- [http-main.ts](./mcp/http-main.ts): Bun HTTP transport entrypoint.
- [http-jsonrpc-ids.ts](./mcp/http-jsonrpc-ids.ts): HTTP-only JSON-RPC id normalization shim.
- [miniflare.worker.ts](./mcp/miniflare.worker.ts): Test worker for MCP HTTP in Miniflare.
- [miniflare.worker.test.ts](./mcp/miniflare.worker.test.ts): MCP HTTP boundary tests, including string id regression coverage.

Why this exists:

- MCP is not just "one endpoint". It has separate concepts for tools, resources, and prompts.
- We support both stdio and HTTP because they serve different clients.
- The Effect MCP stack currently mishandles string JSON-RPC ids on HTTP, so we added [http-jsonrpc-ids.ts](./mcp/http-jsonrpc-ids.ts) to rewrite string ids to numeric surrogates on ingress and restore them on egress.

That file is a good example of accidental complexity:

- It is necessary today.
- It is not conceptually part of the coffee shop.
- If the underlying MCP / RPC stack fixes string ids, we should delete it.

### `cloudflare/`

- [worker.ts](./cloudflare/worker.ts): Production Cloudflare Worker entrypoint. Routes `/api/*`, `/api/assistant`, `/mcp`, and static asset fetches. Binds D1 and Workers AI.

Why this exists:

- Cloudflare deploys want a single Worker fetch entrypoint.
- Our local Bun entrypoints and production Cloudflare entrypoint are not the same runtime shape.
- We want the Worker to reuse the shared REST and MCP surfaces instead of reimplementing them.

### `cli/`

- [command.ts](./cli/command.ts): CLI command tree for local coffee operations.
- [main.ts](./cli/main.ts): CLI entrypoint.

Why this exists:

- The CLI is another presentation surface over the same service.
- It is useful for local workflows and quick smoke tests without HTTP or MCP.

### `dev/`

- [onion-backend-main.ts](./dev/onion-backend-main.ts): In-memory local entrypoint that combines REST and MCP for the onion dev environment.

Why this exists:

- Local dev sometimes wants a cheap, disposable in-memory stack rather than D1 or Cloudflare bindings.

### `shared/`

- [json.ts](./shared/json.ts): Small presentation-only formatter helper.

## The Main Request Flows

### REST

`request -> [api.ts](./http/api.ts) -> CoffeeOrderApp -> HTTP response`

This is the thinnest path.

### Assistant

`UI chat -> [handler.ts](./assistant/handler.ts) -> request decode -> [runtime.ts](./assistant/runtime.ts) -> [tools.ts](./assistant/tools.ts) -> CoffeeOrderApp -> SSE back to UI`

This is thicker because it combines:

- chat protocol translation
- model/runtime selection
- tool orchestration
- progress event emission

### Auth

`browser or agent -> [server.ts](./auth/server.ts) / [agent-auth.ts](./auth/agent-auth.ts) -> CurrentActor or delegated capability execution -> CoffeeOrderApp`

This path owns:

- passkey registration and session lookup
- actor projection into `anonymous | customer | staff`
- delegated capability discovery and execution
- approval-flow integration for `/device/capabilities`

### MCP

`MCP client -> [server.ts](./mcp/server.ts) -> tools/resources/prompts -> CoffeeOrderApp`

On HTTP, the flow is:

`JSON-RPC -> [http-jsonrpc-ids.ts](./mcp/http-jsonrpc-ids.ts) -> Effect MCP server -> JSON-RPC`

### Cloudflare

`Worker fetch -> [worker.ts](./cloudflare/worker.ts) -> shared web handler or assistant handler -> D1 / Workers AI / ASSETS`

## What Is Truly Necessary vs. Compensating Glue

### Necessary

- REST endpoint and schema definitions
- MCP tool/resource/prompt projections
- CLI command definitions
- Cloudflare Worker entrypoint
- assistant tool definitions and assistant-specific request decoding
- auth/session boundary handling and delegated capability execution
- tests at the protocol boundary

### Compensating For Library / Platform Seams

- [http-jsonrpc-ids.ts](./mcp/http-jsonrpc-ids.ts)
  Why: current Effect MCP HTTP path does not preserve string JSON-RPC ids cleanly.
- [rest.ts](./assistant/rest.ts)
  Why: local Bun runs do not have a native Worker AI binding.
- parts of [handler.ts](./assistant/handler.ts) and [runtime.ts](./assistant/runtime.ts)
  Why: TanStack chat messages, Workers AI message formats, and our service/tool model do not align 1:1.
- parts of [chunks.ts](./assistant/chunks.ts)
  Why: the UI wants structured progress over SSE, but our current assistant runtime returns a final text blob after the tool loop.

This is the code most likely to shrink over time.

## Why The Tests Live Here

A lot of the failure modes are protocol-specific:

- wrong JSON-RPC id behavior
- wrong SSE chunk shape
- wrong request-body decoding from the UI
- wrong path rewriting between `/api/*`, `/mcp`, and static assets

Those bugs do not belong in domain tests. They belong next to the boundary code that can regress.

## Known Rough Edges

- The assistant still emits the final answer as a single text chunk after model completion. We surface progress events immediately, but we do not yet token-stream the final answer.
- [http-jsonrpc-ids.ts](./mcp/http-jsonrpc-ids.ts) is a real shim, not an ideal abstraction.
- The assistant path still contains format-bridging logic between TanStack AI, our SSE events, and Workers AI.

## What Could Simplify Later

### 1. Push More Streaming Through TanStack AI

TanStack AI already supports streaming chat responses and recommends SSE for most cases. If we adopt more of its server-side streaming path directly, we may be able to reduce the custom chunk plumbing in `assistant/`.

This is the most obvious near-term simplification.

### 2. Remove the MCP JSON-RPC Shim If Upstream Fixes Land

If the underlying Effect MCP / RPC HTTP stack preserves string ids correctly, [http-jsonrpc-ids.ts](./mcp/http-jsonrpc-ids.ts) should disappear.

### 3. Re-evaluate Shared Session State Only If The Product Needs It

ElectricSQL's newer Durable Streams / Durable Sessions / StreamDB work looks relevant if we move toward:

- resumable chat sessions
- multi-user or multi-agent collaboration
- persistent reactive assistant state
- replayable token streams or event logs

That would be a product-level architecture choice, not a cleanup exercise. It is promising, but not yet justified for the current single-user assistant surface.

### 4. Revisit MCP-Specific Agent Auth When The Published Package Catches Up

The current Better Auth Agent Auth package gives us discovery, approval, and delegated capability execution, but not the MCP adapter shape described in newer docs.

That means [agent-auth.ts](./auth/agent-auth.ts) currently aligns capability names with our MCP actions instead of making `/mcp` itself an Agent Auth transport.

## Reading Order

If you are new to this directory, read in this order:

1. [cloudflare/worker.ts](./cloudflare/worker.ts)
2. [http/api.ts](./http/api.ts)
3. [mcp/server.ts](./mcp/server.ts)
4. [assistant/handler.ts](./assistant/handler.ts)
5. [assistant/runtime.ts](./assistant/runtime.ts)
6. [auth/server.ts](./auth/server.ts)
7. [auth/agent-auth.ts](./auth/agent-auth.ts)
8. [http/web-handler.ts](./http/web-handler.ts)
9. [mcp/http-jsonrpc-ids.ts](./mcp/http-jsonrpc-ids.ts)

That order shows the normal architecture first, then the shims.

## Bottom Line

This directory is not small because we wrote one coffee app in an overcomplicated way.

It is larger because we deliberately kept the service layer clean while exposing the same service through several protocols and runtimes. The cost of that decision is visible here, where it belongs.

Still, not all of this code is sacred. The assistant glue and MCP HTTP shim should be treated as candidates for deletion when the surrounding tooling gets better.
