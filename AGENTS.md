Never use raw WebSearch and WebFetch without first trying another tool, such as:

- Exa via the Executor MCP
- Parallel via the Executor MCP
- Firecrawl via the Executor MCP
- Perplexity via the Executor MCP
- `nia` (for exploring GitHub repos)
- `markit` (for reading URLs as Markdown)

Code style for agents:

- Decode external input once at the boundary, preferably with `effect/Schema`,
  then pass typed domain values inward.
- Do not normalize arbitrary data in app logic with helpers like `asRecord`,
  `hasStringField`, loose `typeof` object checks, or ad hoc string-key probing.
- Avoid `any`, `as`, `in`, `instanceof`, custom `is*` guards, and `try/catch` in
  normal application flow. If a boundary truly requires one of them, isolate it
  to that adapter and keep the rest of the system typed.
- Avoid classic `for (...)` loops, `++`, bitwise operators, and non-null
  assertions in normal application code. Prefer recursion, `for...of`, total
  helpers, and explicit boundary failures over imperative mutation-heavy control
  flow.
- At async interop boundaries, prefer `Effect.promise`, `Effect.async`, or
  `Effect.callback`. Use `Effect.tryPromise` only when you intentionally need to
  translate a thrown or rejected cause into a typed domain error.
- Prefer tagged unions, schema decoders, `Option`/`Either`, and Effect error
  channels over sentinel strings and defensive object spelunking.
- Lint policy has two profiles in `packages/tooling/oxlint.profiles.ts`:
  `backend` adds the Effect house-style plugin, while `ui` focuses on boundary
  safety and unsafe TypeScript escape hatches. Both run every Effect
  language-service rule through `effect-tsgo --tsrs-lint oxlint` (the official
  `@effect/tsgo`, on tsrs's linter). Change the profile instead of adding
  per-workspace Oxlint configs.
- Big, deep modules are welcome. Do not split files or functions just to satisfy
  a tool; no linter enforces file or function length, and Fallow's "split"
  refactoring targets are advisory.
- Fallow owns architecture: zones and allowed imports between workspaces live in
  `.fallowrc.jsonc`, side-effect bans live in `packages/tooling/fallow/` (not
  `.fallow/`, which Fallow gitignores). Put every new file in a zone. Bans on
  outside modules in the portable core (`node:*`, `bun`, platform adapters) are
  `no-restricted-imports` overrides in the backend Oxlint profile.
- Every lint suppression names its rule and gives a reason after `--`.
- When a preference here is deterministic, encode it as a type, lint rule
  (Oxlint profile or the `house` plugin), Fallow rule or test instead of more
  prose.

Design principles:

- Locality of behaviour comes first
  ([essay](https://htmx.org/essays/locality-of-behaviour/)): a unit's behaviour
  should be obvious from that unit alone. Keep business rules in their aggregate
  folder, beside the command, view, policy or saga they govern. Make behaviour
  visible where it is invoked; hide only its implementation.
- Duplicate code, never a source of truth. Prefer a few repeated lines over a
  generic or helper that only threads type parameters or saves lines. Use a
  generic only when it carries a real type relationship and keeps call sites
  readable, like one invariant shared by several commands. Facts such as env-var
  values, route prefixes and resource paths get exactly one definition.
- Keep shared code provider-neutral. Only host adapters (`src/adapters/`) and
  composition roots (the server's `*Worker*.ts` and `CoffeeShop*.ts`, and
  `infra/`) may import a provider such as `@alchemy.run/cloudflare`,
  `@alchemy.run/rivet`, `@cloudflare/*` or `@effect/sql-d1`; `cloudProviders` in
  the backend Oxlint profile enforces the list. Shared code asks for
  capabilities (`SqlClient`, `Config`, a small Effect service), and its caller
  provides them as Layers.
- Declare a port where it is consumed, like `AuthStorage` in `CoffeeServer.ts`.
  Never derive it from one implementation's type, such as
  `Layer.Success<typeof CoffeeShopLive>`. Add a port only when a second
  implementation exists or the code must stay host-neutral; otherwise call the
  thing directly.
- Declare concrete infrastructure (databases, secret stores, buckets) only in
  host adapters and composition roots. Shared code names the service it needs,
  not the resource it runs on.
- Matching types do not mean matching behaviour. When code runs on several
  hosts, test transactions, ordering, retries and idempotency against each
  host's Layer.

Dependency patches live in `patches/`. After upgrading any patched package, run
`bun run patches:check` and delete patches it reports as unused or no longer
needed.

Draw every diagram with Pele (Mermaid sources rendered by `pele`); D2 is banned
in this codebase. Architecture diagrams render with
`node docs/architecture/render.mjs` (see `docs/architecture/README.md`).

For PR descriptions and review materials, use the shared `write-pr-body` skill
(repo overrides in `.agents/skill-config/write-pr-body.md`): prefer Pele diagram
images in tables, concise FAQs, and an honest validation table over long prose.

For creating or revising GitHub issues and proposing issue cleanup, use
`.agents/skills/issue-visual-writing/SKILL.md`: prefer Pele diagrams uploaded
with `gh issue create --attach`, image tables, concise FAQs, and verifiable
acceptance criteria. Keep generated images uncommitted unless an SVG is
intentionally included in a README.
