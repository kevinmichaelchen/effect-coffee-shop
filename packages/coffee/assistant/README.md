# Coffee Assistant

`@effect-coffee-shop/coffee-assistant` is a Coffee presentation adapter for AI chat.

It owns assistant request handling, message conversion, streaming chunks, tool execution, Workers AI formatting, REST fallback runtime wiring, and assistant observability. It depends inward on `coffee-actions` and `coffee-core/application`, but it does not define canonical Coffee business rules or action contracts.

## Directory Map

- `src/handler.ts` handles assistant HTTP requests and streams responses.
- `src/runtime.ts` runs the assistant conversation against a configured AI runtime.
- `src/messages.ts` decodes incoming assistant request messages.
- `src/chunks.ts` defines streamed assistant response chunks.
- `src/observability.ts` logs assistant run and tool activity.
- `src/rest.ts` calls Workers AI over REST for local Bun execution.
- `src/workers-ai-format.ts` converts assistant state to Workers AI request/response shapes.
- `src/tools/definitions.ts` adapts neutral Coffee actions into executable assistant tools.
- `src/tools/parameters.ts` adapts neutral action JSON schemas into Workers AI tool parameter shapes.

## Boundary Rule

Assistant-specific SDK types and tool formatting stay here. Shared Coffee action names, schemas, and execution semantics stay in `coffee-actions`.
