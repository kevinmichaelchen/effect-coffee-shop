# Fallow Roadmap

This roadmap upgrades the existing Fallow setup in small, reviewable steps. Each step should be completed and reviewed before moving to the next one.

## Current Baseline

- Current package catalog pins `fallow` at `2.86.0`.
- Latest reviewed release is `2.86.0`.
- `fallow --summary` is clean on both `2.76.0` and `2.86.0`:
  - 307 files analyzed
  - 838 exports analyzed
  - 0 dead-code findings
  - 0 duplication findings
  - maintainability index 92.5
- `fallow security` on `2.86.0` reports 2 security candidates:
  - `apps/ui/src/shared/lib/http.ts:84`
  - `infra/alchemy/cloudflare.ts:54`
- `fallow health --report-only` on `2.86.0` reports:
  - health score 81 B
  - 22,065 LOC
  - duplication 1.4%
  - 1 churn hotspot in the summary output

## Principles

- Prefer advisory signal before adding new blocking gates.
- Keep each change small enough to review independently.
- Preserve the existing clean baseline unless a new finding is intentional and triaged.
- Do not add remote/cloud/telemetry behavior unless explicitly accepted.
- Treat `fallow security` output as candidates for human or agent verification, not verified vulnerabilities.

## Phase 1: Upgrade Fallow

Status: complete, pending review.

Change the workspace catalog from `fallow: 2.76.0` to `2.86.0`, refresh the lockfile, and run the existing Fallow scripts.

Expected benefit:

- Picks up 10 releases of false-positive reductions and integration fixes.
- Unlocks `fallow security`, `fallow impact`, and health CI gate improvements.
- Low observed migration risk because the latest version produced the same clean summary.

Review gate:

- Confirm lockfile/package changes are minimal.
- Confirm `bun run fallow` and `bun run fallow:audit` still pass.

## Phase 2: Add Advisory Security Scan

Status: complete, pending review.

Add a script for the new opt-in security command:

```json
"fallow:security": "fallow security"
```

Run it manually first and triage the two current SSRF candidates.

Initial triage:

- `apps/ui/src/shared/lib/http.ts:84` is the shared UI `fetch` boundary.
  - Auth/viewer calls use fixed same-origin paths such as `/api/me` and `/api/auth/agent/ciba/pending`.
  - Coffee-shop calls use paths derived from `VITE_COFFEE_API_URL ?? "/api"`, so the destination is build-time configuration-controlled rather than direct user input.
  - Follow-up decision: keep as documented configuration trust, or add a typed same-origin/API-base URL boundary before suppressing.
- `infra/alchemy/cloudflare.ts:54` is a deploy smoke-check fetch.
  - The checked URL is derived from `website.url` returned by the Cloudflare/Alchemy deployment resource.
  - Follow-up decision: keep as provider-controlled deployment output, or validate the host before the smoke check if this value can be overridden externally.
- Current command output also reports 983 unresolved sink sites, so a clean or low-count security output should not be interpreted as complete security coverage.

Expected benefit:

- Adds local security-candidate coverage for dangerous HTML, command injection, code injection, SQL injection, SSRF, path traversal, open redirect, runtime-selectable crypto, unsafe deserialization, and client/server secret leaks.
- Gives immediate review targets without changing the normal `fallow` or `fallow audit` gates.

Review gate:

- Decide whether each current candidate is safe by construction, needs a code change, or needs a local suppression with justification.
- Do not add security to blocking CI until the initial candidates are resolved or documented.

## Phase 3: Add Health Reporting Before Health Gating

Split health usage into explicit advisory and gate scripts.

Suggested first step:

```json
"fallow:health:report": "fallow health --report-only"
```

Only after the advisory report is accepted, consider a conservative gate:

```json
"fallow:health:gate": "fallow health --min-score 80"
```

Expected benefit:

- Makes code-health drift visible without immediately blocking work.
- Creates a controlled path to CI gating once the score and included dimensions are agreed.

Review gate:

- Review the health report output and threshold choice.
- Confirm whether hotspots should be advisory only or part of the blocking gate.

## Phase 4: Enable Local Impact Tracking

Enable `fallow impact` after the upgraded baseline is accepted.

Expected benefit:

- Tracks whether the project is trending cleaner over time.
- Records resolved findings and pre-commit saves without changing exit codes.
- Stores local state under `.fallow/impact.json`.

Review gate:

- Confirm generated local state is ignored as expected.
- Decide whether agents should consult the impact report during reviews.

## Phase 5: Reduce Manual Dependency Ignores

After the upgrade, test whether these can be removed from `ignoreDependencies`:

- `oxlint-tsgolint`
- `@mpsuesser/oxlint-plugin-effect`

Why:

- Recent Fallow releases improved Oxlint tooling and `jsPlugins` dependency crediting.
- This repo has multiple `.oxlintrc.json` files that reference the Effect Oxlint plugin through `jsPlugins`.

Review gate:

- Remove one ignore at a time.
- Run `bun run fallow`.
- Keep only ignores that still represent intentional, documented analyzer gaps.

## Phase 6: Optional CI Integration

If this workspace should enforce Fallow in GitHub CI, add a workflow or extend an existing one to run the existing scripts.

Candidate commands:

```sh
bun run fallow:audit
bun run fallow:ci
bun run fallow:security
```

Expected benefit:

- Converts local checks into PR feedback.
- Allows SARIF/review output later if useful.

Review gate:

- Decide which commands are blocking and which are advisory.
- Do not add SARIF, review comments, cloud upload, or telemetry without a separate review.

## Deferred

- Fallow telemetry: off by default; no current need.
- Fallow cloud/source evidence upload: defer until there is an explicit reporting workflow.
- Runtime coverage intelligence: defer until coverage artifacts are available and worth integrating.
