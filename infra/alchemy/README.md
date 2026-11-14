# Alchemy stack

`cloudflare.ts` is the only stack (`alchemy.run.ts` re-exports it): the Coffee Worker from `coffee-server`, the D1 auth database, Secrets Store, and the `onion` Vite website for `apps/ui`.

`cloudflare.test.ts` deploys it on Alchemy's local emulation and checks health, MCP discovery, and a passkey checkout end to end.

`patches/` carries a workaround for `alchemy@2.0.0-beta.87`; drop it when upstream ships the fix.
