# Coffee Auth

`@effect-coffee-shop/coffee-auth` is a Coffee security and integration adapter package.

It is intentionally cross-cutting: Better Auth handles identity/session concerns, Agent Auth exposes delegated Coffee capabilities, and actor resolution feeds authenticated identity into the application layer. The package depends inward on `coffee-actions` and `coffee-core/application`, while Cloudflare-specific Better Auth wiring is isolated under `src/better-auth`.

## Directory Map

- `src/agent/capabilities.ts` adapts neutral Coffee action specs into Agent Auth capability metadata.
- `src/agent/options.ts` wires Agent Auth execution to `CoffeeOrderApp` with the signed-in customer actor.
- `src/better-auth/cloudflare.ts` configures Better Auth for the current Cloudflare/D1 runtime.
- `src/better-auth/users.ts` owns passkey-first user registration helpers.

## Boundary Rule

Auth may adapt identity and capability protocols to Coffee application use cases, but it should not define canonical Coffee actions or business rules. If Cloudflare-specific auth code grows beyond this adapter, split it into a dedicated runtime package.
