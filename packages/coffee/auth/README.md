# Coffee Auth

`@effect-coffee-shop/coffee-auth` provides Better Auth passkey sign-in and resolves
verified sessions through Yielded Auth subject IDs into Coffee application actors.
This is a staged integration, not a switch of session or credential ownership.
It depends on core actor contracts and
HTTP logging; it does not execute Coffee capabilities or own an application layer.

- [`src/better-auth/shared.ts`](./src/better-auth/shared.ts) configures passkeys and
  resolves anonymous, customer, and staff actors.
- [`src/better-auth/cloudflare.ts`](./src/better-auth/cloudflare.ts) adapts D1 to the
  shared authentication setup.
- [`src/better-auth/users.ts`](./src/better-auth/users.ts) handles passkey-first user registration.
- [`src/yielded/identity.ts`](./src/yielded/identity.ts) projects typed identities
  into customer/staff actors using deployment-owned staff membership.
- [`src/yielded/better-auth.ts`](./src/yielded/better-auth.ts) decodes verified
  legacy users and extracts reusable passkey material without writing to storage.

`@yielded/auth` is pinned to `0.1.0-beta.14`, which supports the repository's
Effect `4.0.0`. See [integration status and cutover requirements](./YIELDED_AUTH.md).
Existing passkeys, signed cookies, registration/sign-in endpoints, synthetic emails,
and historical migrations remain in use.

Run `bun run --cwd packages/coffee/auth test` for cryptographic passkey and session
regressions on local D1 and in-process Postgres, plus Effect boundary tests.

Agent Auth is no longer registered, and its execution and discovery routes are
removed. Historical database migrations are retained so this code change does
not delete existing data; no runtime capability code uses those tables. Any
physical cleanup needs a separate reviewed migration.
