# Alchemy stacks

`stack.ts` is the stack: the Coffee Worker from `coffee-server`, the D1 auth database, Secrets Store, and the `onion` Vite website for `apps/ui`. Each host passes its Worker and providers:

| Stack           | Model host                                     | Run                                   |
| --------------- | ---------------------------------------------- | ------------------------------------- |
| `cloudflare.ts` | Cloudflare Durable Objects                     | `bun run cf:dev`, `bun run cf:deploy` |
| `rivet.ts`      | Rivet, on a local Docker swarm (Docker needed) | `bun run rivet:dev`                   |

`alchemy.run.ts` re-exports `cloudflare.ts`.

`stack.test.ts` deploys a stack on Alchemy's local emulation and checks health, MCP discovery, a passkey checkout, and live order watches end to end: `bun run cf:test` on Cloudflare, `bun run rivet:test` on Rivet.

`patches/` carries workarounds for `alchemy@2.0.0-beta.87` and `@alchemy.run/rivet@2.0.0-beta.87`; drop them when upstream ships the fixes.
