# Coffee Auth

`@effect-coffee-shop/coffee-auth` provides Better Auth passkey sign-in and resolves
sessions into Coffee application actors. It depends on core actor contracts and
HTTP logging; it does not execute Coffee capabilities or own an application layer.

- [`src/better-auth/shared.ts`](./src/better-auth/shared.ts) configures passkeys and
  resolves anonymous, customer, and staff actors.
- [`src/better-auth/cloudflare.ts`](./src/better-auth/cloudflare.ts) adapts D1 to the
  shared authentication setup.
- [`src/better-auth/users.ts`](./src/better-auth/users.ts) handles passkey-first user registration.

Agent Auth is no longer registered, and its execution and discovery routes are
removed. Historical database migrations and SQLFu's legacy table definitions are
retained so this code change does not delete existing data; no runtime capability
code uses those tables. Any physical cleanup needs a separate reviewed migration.
