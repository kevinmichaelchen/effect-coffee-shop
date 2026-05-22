# Coffee Assistant

`@effect-coffee-shop/coffee-assistant` is the Beanline chat assistant package.

It keeps the Beanline flow in one package, but the source tree is split by architectural role:
HTTP/SSE presentation, chat-loop application logic, Coffee tool projection, and external model
provider adapters. It depends inward on [`coffee-actions`](../presentation/actions) and
[`coffee-core/application`](../core/src/application), but it does not define canonical Coffee
business rules or action contracts.

## Directory Map

- [`src/presentation/http/handler.ts`](./src/presentation/http/handler.ts) handles assistant HTTP
  requests and streams responses.
- [`src/presentation/http/messages.ts`](./src/presentation/http/messages.ts) decodes incoming
  assistant request messages.
- [`src/presentation/http/chunks.ts`](./src/presentation/http/chunks.ts) defines streamed assistant
  response chunks.
- [`src/presentation/http/observability.ts`](./src/presentation/http/observability.ts) logs
  assistant run and tool activity at the HTTP boundary.
- [`src/application/runtime.ts`](./src/application/runtime.ts) runs the assistant conversation
  against the `AssistantModelRunner` service.
- [`src/application/model.ts`](./src/application/model.ts) defines Beanline's provider-neutral
  assistant model, model-runner service, message, tool, and tool-call contracts.
- [`src/application/system-prompt.ts`](./src/application/system-prompt.ts) defines the Beanline
  conversation policy.
- [`src/external/providers/config.ts`](./src/external/providers/config.ts) selects concrete model
  provider adapters from runtime configuration.
- [`src/external/providers/workers-ai-runtime.ts`](./src/external/providers/workers-ai-runtime.ts)
  adapts the neutral model runner to Cloudflare Workers AI.
- [`src/external/providers/workers-ai-rest.ts`](./src/external/providers/workers-ai-rest.ts) calls
  Workers AI over REST for local Bun execution.
- [`src/external/providers/workers-ai-format.ts`](./src/external/providers/workers-ai-format.ts)
  converts assistant state to Workers AI request/response shapes.
- [`src/external/providers/ollama-runtime.ts`](./src/external/providers/ollama-runtime.ts) adapts
  the neutral model runner to Ollama's local chat API.
- [`src/tools/definitions.ts`](./src/tools/definitions.ts) adapts neutral Coffee actions into
  executable assistant tools.
- [`src/tools/parameters.ts`](./src/tools/parameters.ts) adapts neutral action JSON schemas into
  assistant tool parameter shapes.

## Boundary Rule

Assistant application code defines the chat loop and `AssistantModelRunner` port. HTTP/SSE code stays
under `src/presentation/http`, and concrete model provider code stays under `src/external/providers`.
Shared Coffee action names, schemas, and execution semantics stay in
[`coffee-actions`](../presentation/actions).

Provider selection belongs at composition roots. The assistant runtime consumes `AssistantModelRunner`
from Effect context, so replacing Workers AI, Ollama, or another model provider should be done by
providing a different runner `Layer` rather than changing the conversation loop.

## Orchestration Decision

Beanline owns the assistant orchestration loop: it builds the system prompt, presents Coffee actions
as model-callable tools, executes selected tools, and asks the model for the next response. Cloud
providers such as Cloudflare Workers AI, Ollama, or a future Amazon Bedrock Runtime adapter should be
inference adapters behind `AssistantModelRunner`.

Do not adopt Bedrock Agents as the first Bedrock integration. Bedrock Agents is a managed
orchestration product, so it would compete with Beanline's tool loop instead of simply providing
model inference. If we later decide that a cloud provider should own orchestration, treat that as a
separate architecture decision and add a separate adapter or surface rather than swapping it into the
current model-runner port.

Alchemy's AWS resources do not currently provide a Bedrock assistant resource in this codebase.
Distilled AWS has generated Bedrock service bindings, which may be enough to build a small Bedrock
control-plane resource, but a Bedrock Runtime or Converse adapter should still stay in
`src/external/providers` and keep provider/model identifiers out of the assistant application loop.
