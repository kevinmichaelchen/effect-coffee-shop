# September 2026 dependency release review

Review of the major/minor upgrades in PR #100, including the Alchemy prerelease
replacement. This records upstream changes separately from recommendations for
this repository. Patch-only upgrades are outside this feature inventory.

## Recommended follow-ups

1. **Use Storybook's project-aware agent commands.** The installed CLI exposes
   `storybook skills`, `storybook tools stories changed`, `docs show`, and
   `test run`. This is the most immediately useful new workflow for the shared
   UI kit and its stories. Both help commands were verified in `apps/ui`.
   [Storybook 10.6 release](https://github.com/storybookjs/storybook/releases/tag/v10.6.0).
2. **Evaluate React View Transitions for order/status changes.** React 19.3
   stabilizes `ViewTransition`, `addTransitionType`, and Fragment refs. Animating
   order-card movement or customer/staff navigation is a plausible use here;
   it should be a separate UI change with reduced-motion and interaction tests.
   Fragment refs are useful only if a concrete focus/measurement need arises.
   [React 19.3 release](https://github.com/react/react/releases/tag/v19.3.0).
3. **Benchmark the experimental native React Compiler before enabling it.**
   Plugin React 6.1 adds `react({ compiler: true })` with `oxc-transform-react`.
   Our config still uses `react()`, so the upgrade alone does not enable it.
   Compare render behavior and build performance in a separate change.
   [Plugin React 6.1.0](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react%406.1.0).
4. **Evaluate Effect-native diagnostics in a scoped cleanup.** New `schemaSync`
   and expanded `nodeBuiltinImport` diagnostics match the project's Effect-first
   policy, but synchronous decoders at SDK boundaries still need deliberate
   treatment. Do not turn these into blanket errors as part of this bump.
   [tsgo 0.43](https://github.com/Effect-TS/tsgo/releases/tag/%40effect/tsgo%400.43.0),
   [tsgo 0.45](https://github.com/Effect-TS/tsgo/releases/tag/%40effect/tsgo%400.45.0).

## Release-by-release assessment

| Upgrade | Relevant changes and repository decision |
| --- | --- |
| React / React DOM 19.2.8 → 19.3.0 | View Transitions and Fragment refs are newly stable. Independent transition rendering and Fast Refresh fixes apply without opting into a new API. The new `react-dom` `browser()` API is for browser-only subtrees during server rendering; this client-rendered Vite app has no immediate use for it. No feature enabled by this PR. [Release](https://github.com/react/react/releases/tag/v19.3.0). |
| Better Auth / passkey / Drizzle adapter 1.6.26 → 1.7.5 | `user.validateUserInfo` can gate creation/linking; `hydrateSession` and directly fetchable auth instances are also new. Existing passkey authority and Effect HTTP routing remain appropriate. More consequential: 1.7.3 enables schema validation by default, while restoring the 1.6 account schema after the short-lived issuer migration. The new provisioning-source argument is already supplied as `{ method: "passkey" }`. [1.7.0](https://github.com/better-auth/better-auth/releases/tag/v1.7.0), [1.7.3](https://github.com/better-auth/better-auth/releases/tag/v1.7.3), [1.7.5](https://github.com/better-auth/better-auth/releases/tag/v1.7.5). |
| Vitest 4.1.10 → 5.0.0 for backend/package tests | Adds `vi.when()`, nested projects, top-level `fsModuleCache`, report-merging improvements, and `--repeats`. More useful immediately are the stricter failure rules for unawaited asynchronous assertions and polling timeouts. Node must be at least 22.12 and Vite at least 6.4. Mock history now clears before each test; ancestor config lookup and several deprecated entry points are removed. See migration assessment below. [Release](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0). |
| Storybook 10.5.7 → 10.6.0 | Agent skills/tools are the main new opportunity. Test-glob resolution against the project root is relevant to stories split between `apps/ui` and `packages/ui-kit`. Vitest prebundling and stack-trace fixes improve the existing setup. The removed experimental Playwright component-testing integration is not our Vitest browser setup. Keep the UI runner/browser packages at 4.1.11 until the addon supports Vitest 5. [Release](https://github.com/storybookjs/storybook/releases/tag/v10.6.0). |
| Vite 8.2.1 → 8.3.0 | Optimizes build-time preload handling and precompiles proxy matchers; also fixes dependency-path classification and CRLF error locations. Existing builds/proxy configuration receive these benefits without a new app API or config migration. [Release](https://github.com/vitejs/vite/releases/tag/v8.3.0). |
| Vite React plugin 6.0.5 → 6.1.1 | Experimental native compiler support is opt-in and requires another package. 6.1.1 hides recoverable compiler diagnostics by default; use `compiler.logDiagnostics` during any compiler evaluation. Fatal diagnostics still fail transforms. [6.1.0](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react%406.1.0), [6.1.1](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react%406.1.1). |
| Playwright 1.62.1 → 1.63.0 | Adds visible-only locators, frame-subtree lookup, richer ARIA/screen traces, and named test locks. Locks and runner-level reporter features belong to the Playwright runner, not our Vitest Storybook runner. Browser/trace capabilities may help future UI debugging. New browser binaries were installed; CI already installs the matching Chromium. Ubuntu 20.04 support ends; our workflow uses `ubuntu-latest`. [Release](https://github.com/microsoft/playwright/releases/tag/v1.63.0). |
| TanStack React Query 5.101.4 → 5.102.8 | Prefetch hooks now use the newer query-client methods. Experimental render-time prefetching, result `promise`, and experimental before/after-query hooks are removed. The app uses ordinary `useQuery`/`useMutation` and invalidation; none of those removed APIs appear in `apps/ui/src`. No rewrite needed. [5.102.0](https://github.com/TanStack/query/releases/tag/%40tanstack/react-query%405.102.0), [5.102.8](https://github.com/TanStack/query/releases/tag/%40tanstack/react-query%405.102.8). |
| Lucide React 1.30 → 1.46 | Mostly new or revised icons. `shopping-cart-plus/minus`, `list-clock`, and payment-status icons could fit future order UI. Existing imports are Menu, MoonStar, SunMedium, X, Check, and chevrons; no replacement is required. Existing artwork can change even when imports compile, so passing stories are not a visual snapshot guarantee. [1.33](https://github.com/lucide-icons/lucide/releases/tag/1.33.0), [1.37](https://github.com/lucide-icons/lucide/releases/tag/1.37.0), [1.40](https://github.com/lucide-icons/lucide/releases/tag/1.40.0). |
| tailwind-merge 3.6 → 3.7 | Adds theme-key metadata for tooling and fixes class conflicts, including logical padding versus axis padding, `max-h-none`, and some arbitrary colors. Our shared `cn` helper benefits automatically; no custom theme-getter integration to adopt. [Release](https://github.com/dcastil/tailwind-merge/releases/tag/tailwind-merge%403.7.0). |
| pglite-test 1.0.3 → 1.17.1 | The package changelog marks every intervening release as a version-only bump. Do not infer 17 new harness features from the version jump. Transitive dependencies still change, so the existing PGlite and real PostgreSQL contracts remain the evidence for compatibility. `@electric-sql/pglite` itself only received a patch bump. [Package changelog](https://github.com/constructive-io/constructive/blob/pglite-test%401.17.1/postgres/pglite-test/CHANGELOG.md). |
| `@effect/tsgo` 0.41 → 0.45 | Adds simplification diagnostics for match/catch/provide patterns; obsolete Effect schema/match import checks; expanded Node-builtin guidance; opt-in `schemaSync`. Compiler diagnostics already show the new suggestions, and typecheck passes. Preserve current severity policy pending a focused cleanup. [0.42](https://github.com/Effect-TS/tsgo/releases/tag/%40effect/tsgo%400.42.0), [0.43](https://github.com/Effect-TS/tsgo/releases/tag/%40effect/tsgo%400.43.0), [0.44](https://github.com/Effect-TS/tsgo/releases/tag/%40effect/tsgo%400.44.0), [0.45](https://github.com/Effect-TS/tsgo/releases/tag/%40effect/tsgo%400.45.0). |
| Varlock 1.18 → 1.19 | Adds custom env-access audit patterns, `domainFromUrl`, cache TTL callbacks, and credential-proxy transforms. The audit patterns could help inspect Effect Config access later, but this repo currently uses `load/run`. New sensitive-value checks can reject very short or non-string explicitly sensitive values. Existing cache secrets are strings with minimum length 32; the optional Cloudflare token still needs a valid supplied value. No schema edit indicated. [Release](https://github.com/dmno-dev/varlock/releases/tag/varlock%401.19.0). |
| Alchemy / Cloudflare runtime preview → beta.78 | The exact preview commit is one commit behind beta.78, and that commit is the release commit. This is principally a move to published packages, not adoption of the entire beta.77→78 feature list. Local Cloudflare deployment tests validate the installed package graph; no live infrastructure deployment was performed. [Exact comparison](https://github.com/alchemy-run/alchemy/compare/edb8192a67b375730d768006b4fc507271f291bd...v2.0.0-beta.78). |
| Bun, Node, and React type declarations | Bun 1.4.2 typings align with the already-pinned Bun 1.4.2 runtime; React 19.3 types align with React 19.3. Node types move from locked 26.2 to 26.5.1 while the runtime remains pinned to 26.8.1. These provide declarations, not runtime features; no new runtime APIs were adopted. [DefinitelyTyped Node history](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/master/types/node), [Bun history](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/master/types/bun), [React release](https://github.com/react/react/releases/tag/v19.3.0). |

## Migration checks and added coverage

- **Better Auth:** This app configures passkeys, not the OAuth, SCIM, captcha,
  device-flow, or Better Auth MCP plugins affected by most 1.7 migration steps.
  Its Effect MCP server is a separate integration. `baseURL` is explicitly set
  from the request URL. No issuer backfill is indicated when going directly
  from 1.6.26 to 1.7.5, because 1.7.3 restored the old account schema.
  [1.7.0 migration notes](https://github.com/better-auth/better-auth/releases/tag/v1.7.0),
  [1.7.3 correction](https://github.com/better-auth/better-auth/releases/tag/v1.7.3).
- **D1 validation:** Added an integration test to `infra/alchemy/cloudflare.test.ts`
  that requests passkey registration options inside the local Worker with the
  real migrations applied, decodes the challenge/RP/user response, and requires
  HTTP 200. All four infrastructure tests pass. This exercises schema validation
  and registration-option generation; it does not simulate a completed WebAuthn
  ceremony or validate an already-deployed production database.
- **Vitest:** Source/config search found no mock-history dependencies, `vi.*`,
  `sequential`, `expect.poll`, or deprecated runner entry-point imports in our
  TypeScript tests. Backend configs are workspace-local; the UI inline projects
  stay on Vitest 4. Existing Node 26.8.1/Vite 8.3 satisfy the new minimums.
  [Vitest 5 breaking changes](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0).

The initial bump passed static checks, backend tests, all 44 Storybook tests,
production build, 22 PostgreSQL/PGlite tests, Fallow and both Knip modes. This
review adds targeted auth coverage and feature recommendations; it does not
silently enable the compiler, animations, new auth methods, or new lint presets.
