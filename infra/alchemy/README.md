# Alchemy stacks

`stack.ts` is the stack every host shares: the Coffee Worker from `coffee-server`, the D1 auth
database, Secrets Store, and the `onion` Foldkit website for `apps/ui`. Each host supplies its own
Worker and providers.

| Stack           | Model host                                     | Run                 | Deploy              |
| --------------- | ---------------------------------------------- | ------------------- | ------------------- |
| `cloudflare.ts` | Cloudflare Durable Objects                     | `bun run dev`       | `bun run cf:deploy` |
| `rivet.ts`      | Rivet, on a local Docker swarm (Docker needed) | `bun run rivet:dev` | —                   |

<details>
<summary>Stack tests, aliases and patches</summary>

`alchemy.run.ts` re-exports `cloudflare.ts` as the default config the `alchemy` CLI picks up.

`stack.test.ts` deploys a stack on Alchemy's local emulation and checks health, MCP discovery, a
passkey checkout, and live order watches end to end: `bun run cf:test` on Cloudflare, `bun run
rivet:test` on Rivet. These are the slow checks behind `bun run check:release`, so commits and
ordinary pushes skip them.

`patches/` carries workarounds for Rivet’s Docker Swarm types and Yielded’s passkey registration.

</details>
