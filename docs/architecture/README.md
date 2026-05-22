# Architecture Diagrams

- [Package Layers](./package-layers.svg) shows the onion-style package dependency direction.
  Dependencies point inward. `coffee-actions` is the application layer bridge into
  `coffee-core`; `backend-host` is reusable runtime plumbing, not a Coffee onion layer.
- [Backend Runtime Surfaces](./backend-runtime-surfaces.svg) shows how deployable runtimes expose
  HTTP, MCP, auth, assistant, discovery, and assets through the Fetch host.
  Package dependencies are intentionally hidden from this view.

Editable D2 sources live beside the rendered SVGs.
