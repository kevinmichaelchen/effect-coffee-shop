# Architecture Diagrams

- [Overview](./overview.svg), shown at the top of the root README, is the system at a glance:
  clients, the two Workers, the presentation surfaces, and the Cloudflare platform beneath them.
- [Package Layers](./package-layers.svg) shows the package dependency direction.
  Dependencies point inward to `coffee-domain`, the `@alchemy.run/domain` model, which imports no
  other workspace. `coffee-application` is a thin service over the model for MCP and REST;
  `coffee-actions` lives under presentation as shared tool metadata. `coffee-server` is the
  only composition root, and `infra/alchemy` deploys it.
- [Backend Runtime Surfaces](./backend-runtime-surfaces.svg) shows how a request reaches the
  Coffee Worker through the Website Worker and which surface handles each path. Package
  dependencies are intentionally hidden from this view.

Editable D2 sources live beside the rendered SVGs. Regenerate with
`d2 package-layers.d2 package-layers.svg` (and likewise for the other diagram).

The overview is Mermaid in `overview.mmd`, rendered by [Pele](https://github.com/obsidianmd/pele)
and framed with seeded woodcut ornaments from
[alembic-ornaments](https://github.com/lauriparonen/alembic-ornaments). The seeds are fixed, so a
rerender only changes what the source changes. Regenerate from the repository root:

```sh
mkdir -p .context/diagram-tools
printf '{"private":true,"type":"module"}\n' > .context/diagram-tools/package.json
npm install --prefix .context/diagram-tools --ignore-scripts --no-audit --no-fund pele@1.13.0 @lauriparonen/alembic-ornaments@0.1.0
node docs/architecture/render-overview.mjs
```
