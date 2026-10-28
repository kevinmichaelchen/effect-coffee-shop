# Packages

Library workspaces live under `packages/`. Coffee-specific libraries are nested
under `packages/coffee`, while shared utilities stay directly under `packages`.

## Packages

- [`coffee/domain`](./coffee/domain): the event-sourced `@alchemy.run/domain` model
  (aggregates, views, policy, `CustomerApi`/`StaffApi`, menu). Depends only on
  `alchemy` and `effect`.
- [`coffee/application`](./coffee/application): `CoffeeOrderApp`, a thin service
  over the model used by MCP tools, plus MCP/REST contracts, actors, and errors.
- [`coffee/presentation/actions`](./coffee/presentation/actions):
  protocol-neutral Coffee action catalog used by Effect MCP tools.
- [`coffee/presentation/http`](./coffee/presentation/http): REST routes for
  health, menu, and the signed-in actor.
- [`coffee/presentation/mcp`](./coffee/presentation/mcp): MCP resources,
  prompts, Effect AI toolkit projection, tools, and the HTTP MCP Layer.
- [`coffee/auth`](./coffee/auth): Yielded Auth passkeys, MCP OAuth, actor
  resolution, and the D1 auth migrations.
- [`coffee/server`](./coffee/server): the Coffee Worker that hosts the model on
  Durable Objects and serves the Apis, auth, REST, and MCP.
- [`http-routing`](./http-routing): wide-event request logging and generic Web
  HTTP routing helpers.
- [`turbo-cache`](./turbo-cache): the self-hosted Turborepo remote cache service.
- [`tooling`](./tooling): shared Oxlint policy and Go custom lint rules.

## Layer Placement

Business rules live in [`coffee/domain`](./coffee/domain). It never imports
another workspace, so the same model runs on `Domain.InMemory` in tests and on
Durable Objects in production. [`coffee/application`](./coffee/application)
only adapts that model for non-Api surfaces; it holds no rules of its own.

Presentation packages export route and MCP server Layers over `CoffeeOrderApp`.
They do not choose the platform. [`coffee/server`](./coffee/server) is the only
composition root: it picks `DomainCloudflare.DurableObjects`, binds D1 and
Secrets Store, and mounts every surface. [`infra/alchemy`](../infra/alchemy)
deploys it.
