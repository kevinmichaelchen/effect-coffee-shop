# Architecture Diagrams

- [Package Layers](./package-layers.svg) shows the onion-style package dependency direction.
  Dependencies point inward. `coffee-actions` lives under presentation as shared capability
  metadata that dispatches into `coffee-core`; `backend-host` is reusable runtime plumbing, not a
  Coffee onion layer.
- [Backend Runtime Surfaces](./backend-runtime-surfaces.svg) shows how deployable runtimes expose
  HTTP, MCP, auth, assistant, discovery, and assets through the Fetch host.
  Package dependencies are intentionally hidden from this view.
- [Assistant Boundaries](./assistant-boundaries.svg) shows the internal assistant split between
  HTTP/SSE presentation, chat-loop application logic, Coffee tool projection, and external model
  providers.

Editable D2 sources live beside the rendered SVGs.
