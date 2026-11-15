# Packages

Library workspaces live under `packages/`; Coffee-specific ones are nested under `packages/coffee`,
shared ones sit directly beside it, and `tooling/` holds the lint and architecture policy.

| Package                                                        | What it is                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`coffee/domain`](./coffee/domain)                             | Event-sourced `@alchemy.run/domain` model: aggregates, views, Apis, menu |
| [`coffee/routes`](./coffee/routes)                             | The backend path prefixes, defined once                                  |
| [`coffee/application`](./coffee/application)                   | `CoffeeOrderApp`: menu, pricing and order reads for MCP                  |
| [`coffee/auth`](./coffee/auth)                                 | Yielded Auth passkeys, MCP OAuth, D1 migrations                          |
| [`coffee/server`](./coffee/server)                             | The Coffee Worker and the model's hosts                                  |
| [`coffee/presentation/actions`](./coffee/presentation/actions) | Hand-written tool catalog                                                |
| [`coffee/presentation/http`](./coffee/presentation/http)       | REST surfaces                                                            |
| [`coffee/presentation/mcp`](./coffee/presentation/mcp)         | MCP resources, prompts, tools, HTTP layer                                |
| [`http-routing`](./http-routing)                               | Wide-event request logging for HTTP                                      |
| [`ui-kit`](./ui-kit)                                           | Foldkit view primitives and theme utilities                              |
| [`turbo-cache`](./turbo-cache)                                 | Self-hosted Turborepo remote cache service                               |
| [`tooling`](./tooling)                                         | Oxlint profiles, the `house` plugin, Fallow rule packs                   |

Dependency direction, including `apps/ui` and `infra/alchemy`:
[package layers](../docs/architecture/package-layers.svg).

<details>
<summary>Layer placement rules</summary>

Business rules live in [`coffee/domain`](./coffee/domain). It never imports another workspace, so the
same model runs on `Domain.InMemory` in tests and on Durable Objects or Rivet in production.
[`coffee/application`](./coffee/application) adapts that model for surfaces that do not speak the
Apis; it holds no rules of its own, and orders, carts and staff go through the domain Apis.

Presentation packages export route and MCP server Layers. They do not choose the platform.
[`coffee/server`](./coffee/server) is the only composition root: it picks the model host, binds D1
and Secrets Store, and mounts every surface. [`infra/alchemy`](../infra/alchemy) deploys it.

</details>
