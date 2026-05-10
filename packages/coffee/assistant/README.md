# Coffee Assistant

`@effect-coffee-shop/coffee-assistant` is a Coffee presentation adapter for AI chat.

It owns assistant request handling, message conversion, streaming chunks, tool execution, provider-neutral model orchestration, provider adapter wiring, and assistant observability. It depends inward on `coffee-actions` and `coffee-core/application`, but it does not define canonical Coffee business rules or action contracts.

## Directory Map

- `src/handler.ts` handles assistant HTTP requests and streams responses.
- `src/runtime.ts` runs the assistant conversation against the `AssistantModelRunner` service.
- `src/model.ts` defines Beanline's provider-neutral assistant model, model-runner service, message, tool, and tool-call contracts.
- `src/messages.ts` decodes incoming assistant request messages.
- `src/chunks.ts` defines streamed assistant response chunks.
- `src/observability.ts` logs assistant run and tool activity.
- `src/workers-ai-runtime.ts` adapts the neutral model runner to Cloudflare Workers AI.
- `src/workers-ai-rest.ts` calls Workers AI over REST for local Bun execution.
- `src/workers-ai-format.ts` converts assistant state to Workers AI request/response shapes.
- `src/ollama-runtime.ts` adapts the neutral model runner to Ollama's local chat API.
- `src/tools/definitions.ts` adapts neutral Coffee actions into executable assistant tools.
- `src/tools/parameters.ts` adapts neutral action JSON schemas into assistant tool parameter shapes.

## Boundary Rule

Assistant-specific SDK types and tool formatting stay in provider adapter modules. Shared Coffee action names, schemas, and execution semantics stay in `coffee-actions`.

Provider selection belongs at composition roots. The assistant runtime consumes `AssistantModelRunner` from Effect context, so replacing Workers AI, Ollama, or another model provider should be done by providing a different runner `Layer` rather than changing the conversation loop.
