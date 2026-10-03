# Yielded Auth integration status

This PR adopts the published `@yielded/auth@0.1.0-beta.14` identity and passkey
schemas while retaining Better Auth as the credential/session owner. A full
cutover cannot safely reuse the stored rows as Yielded credentials or sessions.
No database migration, deletion, dual write, alternative sign-in endpoint, or
replacement cookie is introduced.

## Published API and Effect compatibility

Inspected on 2026-10-03: the npm `beta` tag points to `0.1.0-beta.14`; `latest`
still points to `0.1.0-beta.1`. Install the exact catalog version rather than
implicitly selecting `latest`. The beta.14 tarball declares `effect: ^4.0.0`
as its only peer dependency and has no runtime dependencies. Its identity/passkey
API is exercised against this repository's pinned Effect `4.0.0`.
There is no release-age exemption for Yielded. `bun install --frozen-lockfile`
installs the inspected, exact beta from the committed lockfile. Until beta.14
passes the normal three-day window, Bun rejects dependency re-resolution that
selects it again; future Yielded versions remain subject to the same policy.

Research used the [official passkey guide](https://yielded.dev/auth/guide/passkeys),
[session guide](https://yielded.dev/auth/guide/sessions),
[adapter reference](https://yielded.dev/auth/reference/adapters), npm metadata and
published declarations/source. Upstream source was inspected at
[`33e8c3a`](https://github.com/yielded-dev/auth/tree/33e8c3a5aa6ba8f010986d5b607e6d3db456b9fa).
This PR installs only the core package; it does not install persistence or verifier
companions whose storage/authority requirements are not yet implemented.

The beta.14 companions expose these choices:

| Package                             | API and requirements                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `@yielded/auth-persistence`         | Direct Effect SQL composition and shared adapter contracts; application-owned migrations and subject authority.                       |
| `@yielded/auth-persistence-drizzle` | `/SqliteBun`, `/D1`, `/Postgres`, `/Pglite`, and other explicit drivers; peers include Effect/SQL `4.0.0` and Drizzle `>=1.0.0-rc.4`. |
| `@yielded/auth-simplewebauthn`      | `/Server` and `/Browser`; SimpleWebAuthn server `>=14.0.1 <15` and browser `>=14.0.0 <15`. Better Auth currently uses version 13.     |

The repository already patches Drizzle RC4 for Effect 4. A future companion
integration must compare that patch with Yielded's documented patch, rather than
overwriting it. D1's conditional batch ownership and interactive PostgreSQL/SQLite
transactions require distinct adapters; replacing one with sequential writes does
not preserve atomicity.

## Implemented boundary

`resolveCoffeeActor` still asks Better Auth to verify the incoming signed session
cookie. Only the returned user reaches `identityFromVerifiedBetterAuthUser`.
The boundary decodes that user once and maps its unchanged ID to Yielded's
`SubjectId`. `actorFromIdentity` uses Yielded's lossless string ID codec and
deployment `staffUserIds` to resolve Coffee authority. Session/user role fields
cannot grant staff or system access. Display names retain trimming and email
fallback. Missing secrets and absent/invalid sessions remain anonymous.

The Cloudflare boundary explicitly forwards D1 methods with their original
receiver. Better Auth's structural dialect detection otherwise fails for the
local Cloudflare RPC proxy. It retains D1's original batch implementation.

`decodeBetterAuthPasskeyMaterial` accepts a persisted row and returns validated
credential/subject IDs, protocol credential ID, counter, and public-key bytes in
canonical base64url. Better Auth stores the key in standard base64. This decoder
does not authenticate, validate a COSE algorithm, import a credential, or fabricate
the missing metadata below. It has no database access or writes. Malformed rows
produce a typed error without including the rejected row or key.

## Why credential and session cutover remains blocked

1. **Missing WebAuthn user handle.** Better Auth 1.7.6 generates random 32-byte
   registration `userID` bytes. It stores the application user ID in the temporary
   verification record, but not those random bytes in the passkey row. Yielded's
   `PasskeyCredential` requires the actual authenticator `userHandle`. Deriving it
   from `user.id` would be incorrect. Existing handles need recovery during an
   authenticated ceremony or explicit re-enrollment, with verified RP/credential
   ownership; neither is available from a database-only conversion.
2. **Missing authentication authority.** Legacy users/passkeys lack subject and
   credential security revisions, enrollment user-verification evidence, profile
   generation and RP-scoped ownership records. Yielded rechecks these alongside
   challenge consumption, counter updates and session issuance. Enrollment UV
   cannot be inferred from a valid legacy session: Better Auth allows registration
   without requiring UV. The key's COSE algorithm can be decoded in a later adapter,
   but doing that does not recover the absent authority evidence.
3. **Different session model.** Better Auth stores raw opaque tokens and signs the
   cookie. Yielded stateful sessions use namespaced digests, credential/row versions,
   authentication provenance, security revisions and separate absolute/idle
   lifetimes. These cannot be reconstructed truthfully from `createdAt`,
   `updatedAt`, `expiresAt` and `token`. Yielded's session service must not be
   supplied synthetic assurance or provenance to accept legacy cookies.
4. **Different registration and HTTP contracts.** Yielded's passkey registration
   provisions a subject (or a pending result); it does not automatically establish
   a session. The current UI expects registration with `createSession: true` and
   Better Auth's endpoints, response bodies, challenge cookies, and client plugin.
   A coordinated browser/server flow and explicit registration authority are
   required to preserve that user journey.

These are data/behavior incompatibilities, not an Effect version mismatch. A safe
next phase needs additive storage for explicit subject/credential authority and
verified handles, a legacy-cookie bridge with revocation/expiry parity, and
registration/session completion on all persistence owners. Keep legacy readers
and data until old sessions expire and credential ownership has been verified.
No migration should delete historical Agent Auth tables as part of this work.

## Verification and runtime limits

The D1 tests create an ES256 software authenticator and exercise real registration
and authentication verification, signup session creation, customer/staff mapping,
sign-out revocation, expired/forged cookies, forged signatures, replay rejection,
and wrong-origin rejection without persisting a user/credential/session. They also
read the real stored passkey through the material decoder.
Local D1's RPC proxy emits index-introspection batch errors from Miniflare;
Better Auth falls back and the credential/session assertions still pass. This is
not a claim that D1 supports interactive registration transactions.

The AWS regression applies the repository's committed Postgres migrations to
PGlite and calls the actual `makeBetterAuthDatabase` factory used by `backend.ts`.
The test supplies PGlite-backed async Drizzle and committed-migration layers;
the auth factory is unchanged.
It tests signup, passkey sign-in, material decoding, actor mapping, revocation
and expiry. Before the fix, the same test reproduced missing model tables; fixing
only the model names then reproduced HTTP 500 (`res.map is not a function`)
because Better Auth awaited Effect queries.

AWS now supplies a Promise-based `drizzle-orm/node-postgres` service and explicit
`user`/`session`/`account`/`passkey`/`verification` schema keys. Auth owns a scoped
`pg` pool with at most two connections, using the same `COFFEE_POSTGRES_URL` as the
Effect application pools; auth runtime disposal closes its pool. Schema readiness
still comes from the existing migration layer. No tables, credentials or sessions
are rewritten. Effect tests cover exact opaque IDs, role escalation attempts,
name fallback and malformed input.

This does not claim deployed AWS, a networked Postgres server or browser-device
verification. Cloudflare/AWS share the changed actor boundary. The D1 wrapper
forwards only `prepare`, `batch` and `exec`, preserving receivers without requiring
optional `withSession` or deprecated `dump`; the credential/session test exercises
a binding with only those three methods.
Bun's current HTTP entrypoints compose application HTTP routes without mounting
the `/api/auth` endpoints; this PR does not silently change that topology.
