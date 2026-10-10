# Yielded Auth implementation notes

The application pins the Yielded package family to `0.1.0-beta.32`, inspected
from the published npm packages and the matching
[upstream tag](https://github.com/yielded-dev/auth/tree/%40yielded/auth%400.1.0-beta.32).
This version supports Effect 4 and includes native SQL persistence, passkey
registration, browser ceremony adapters, and typed HTTP clients.

The exact beta.32 family is recorded in the committed lockfile and installs with
`bun install --frozen-lockfile`. Yielded has no release-age exemption: dependency
re-resolution that selects these packages is subject to Bun's three-day policy
(beta.32 was published on 2026-10-10). SimpleWebAuthn server/browser 14 perform
the WebAuthn protocol work.

## Persistence

Application-owned SQL migrations define subjects, credential authority,
passkey credentials and flows, sessions, and pending authentication records.
Subjects and credentials carry security revisions. Session rows store digests
of opaque credentials, validated provenance, and idle/absolute expirations.

The managed storage descriptor supplies table definitions and session mappings.
Passkey registration uses an explicit native SQL mapping because it also needs
the application's display-name snapshot and subject creation policy. Subject
IDs are random UUIDs generated at the trusted persistence boundary.

PostgreSQL and Bun SQLite use interactive Effect SQL transactions. Cloudflare
D1 uses Yielded's conditional batch implementation with `D1Client.batch`.
Atomic credential updates are never emulated by sequential statements.
The Alchemy local platform proxy cannot pass prepared statement objects through
batch calls correctly; integration tests use Miniflare's D1 binding. Deployed
Workers receive native D1 bindings.

The current fixed authentication requirement is a recent, user-verified,
phishing-resistant possession factor. The empty `requirementColumns` declaration
means this policy is application configuration rather than mutable subject data.
Credential management and alternate sign-in methods are not exposed by the
Coffee contract.

## HTTP and identity

The shared contract defines registration, login, session lookup and logout.
Yielded handles CSRF admission, bound challenges, secure cookie delivery and
session verification. Browser route middleware uses Yielded's `http.withRequest`
and calls `getSession()` directly, preserving cookie delivery on the actual response.
`/api/me` returns the application actor. The actor probe exists only in test fixtures.
Only server configuration selects staff membership. Application authorization
stays in Coffee's existing use cases.

All runtimes and the UI use the new contract. There is no legacy-cookie bridge
or dual write. Historical migrations are retained; the new migration deliberately
discards the unused prototype auth data.

## Official integration patterns

- [Yielded HTTP integration](https://yielded.dev/auth/guide/http-and-client): shared
  auth layer and request boundary, direct service calls, typed identity projection.
- [Yielded Effect MCP example](https://github.com/yielded-dev/auth/blob/main/examples/auth/src/strava-mcp.ts):
  `OAuthServer`, its bearer middleware, `CurrentAccess`, durable `OAuthServerPersistence`,
  and application-owned permissions. Consent rendering, PKCE, discovery, refresh,
  and revocation are supplied by Yielded.
- [Alchemy connection lifecycle](https://alchemy.run/sql/effect-sql/lifecycle):
  disposable database resources belong to an execution scope. Our Fetch adapter
  acquires and awaits disposal of one complete route graph per request. There is
  no process-global mutable auth cache or request-derived trusted origin.
- [Alchemy layers](https://alchemy.run/infrastructure-as-effects/layers): hosts select
  database adapters; the shared backend selects replaceable `AuthAdaptersLive` layers.

HTTP MCP uses Effect's stateless `McpProtocol.v2026_07_28`. Each request carries
protocol metadata and OAuth credentials. Older in-memory HTTP session protocols
are deliberately unsupported: Workers/Lambda cannot rely on instance affinity.
Stdio is explicitly a local system-operator interface.

The beta.32 managed adapters were evaluated. We retain the supported native SQL
composition because passkey **registration** also provisions our subject and display
name atomically, and D1 requires conditional batches with a constant assurance policy.
Adding Drizzle solely to auth would not remove that integration. OAuth storage uses
Yielded's provided adapter and published migrations on both databases.

## Rate-limit lifetime

The [official shared-store recipe](https://yielded.dev/auth/guide/rate-limits)
uses `Persistence.keyValueRateLimiterStore`. We supply an Effect `KeyValueStore`
with the same database layer, so rebuilding the request runtime preserves identifier,
subject, and target counters. Yielded hashes bucket identifiers before persistence.

Effect 4.0.0's built-in `KeyValueStore.layerSql` assumes blob results are typed
buffers; D1 returns number arrays and a second read fails in `TextDecoder`.
A regression test covers this boundary. `KeyValueStore.makeStringOnly` supplies
the standard store interface over a small schema-decoded SQL text adapter. The
committed OAuth migrations also create `coffee_auth_rate_limits`; no rate-limit
algorithm or custom cache is implemented by the application.

This is approximate accounting: its read/write sequence is not atomic under
concurrency. Action/module budgets remain local to an auth acquisition. This toy
has no aggregate edge quota; deployments needing strict distributed admission
should replace the injected rate-limit layer with an atomic shared store (the
Yielded guide points to Effect's Redis store), and configure ingress limits.
