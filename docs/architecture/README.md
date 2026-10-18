# Architecture Diagrams

- [Package Layers](./package-layers.svg) shows the package dependency direction.
  Dependencies point inward to `coffee-domain`, the `alchemy/Domain` model, which imports no
  other workspace. `coffee-application` is a thin service over the model for MCP and REST;
  `coffee-actions` lives under presentation as shared tool metadata. `coffee-server` is the
  only composition root, and `infra/alchemy` deploys it.
- [Backend Runtime Surfaces](./backend-runtime-surfaces.svg) shows how a request reaches the
  Coffee Worker through the Website Worker and which surface handles each path. Package
  dependencies are intentionally hidden from this view.

Editable D2 sources live beside the rendered SVGs. Regenerate with
`d2 package-layers.d2 package-layers.svg` (and likewise for the other diagram).
