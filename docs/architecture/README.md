# Architecture Diagrams

Every diagram here is Mermaid (`*.mmd`) rendered by [Pele](https://github.com/obsidianmd/pele); D2 is
not used.

| Diagram                                                    | Answers                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| [Overview](./overview.svg)                                 | What the system is at a glance.                                |
| [Package Layers](./package-layers.svg)                     | Which package depends on which.                                |
| [Backend Runtime Surfaces](./backend-runtime-surfaces.svg) | Which surface serves a request that reaches the Coffee Worker. |
| [Order Lifecycle](./order-lifecycle.svg)                   | Which moves a ticket may make, and which it may not.           |
| [Checkout Flow](./checkout-flow.svg)                       | How a confirmed cart becomes a placed order.                   |
| [Cache Requests](./cache-requests.svg)                     | How Turbo reaches the self-hosted cache on each cloud.         |

<details>
<summary>Reading and regenerating</summary>

Package dependencies are deliberately hidden from the runtime-surfaces view, and the overview is
framed with seeded woodcut ornaments from
[alembic-ornaments](https://github.com/lauriparonen/alembic-ornaments). The seeds are fixed, so a
rerender only changes what the source changes. Regenerate every diagram from the repository root:

```sh
mkdir -p .context/diagram-tools
printf '{"private":true,"type":"module"}\n' > .context/diagram-tools/package.json
npm install --prefix .context/diagram-tools --ignore-scripts --no-audit --no-fund pele@1.13.0 @lauriparonen/alembic-ornaments@0.1.0
node docs/architecture/render.mjs
```

Rendering tools live only in `.context`; they are not application dependencies. A committed SVG is
only here because a README embeds it.

</details>
