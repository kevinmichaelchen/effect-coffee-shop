Never use raw WebSearch and WebFetch without first trying another tool, such as:

- Exa via the Executor MCP
- Parallel via the Executor MCP
- Firecrawl via the Executor MCP
- Perplexity via the Executor MCP
- `nia` (for exploring GitHub repos)
- `markit` (for reading URLs as Markdown)

Code style for agents:

- Decode external input once at the boundary, preferably with `effect/Schema`, then pass typed domain values inward.
- Do not normalize arbitrary data in app logic with helpers like `asRecord`, `hasStringField`, loose `typeof` object checks, or ad hoc string-key probing.
- Avoid `any`, `as`, `in`, `instanceof`, custom `is*` guards, and `try/catch` in normal application flow. If a boundary truly requires one of them, isolate it to that adapter and keep the rest of the system typed.
- Avoid classic `for (...)` loops, `++`, bitwise operators, and non-null assertions in normal application code. Prefer recursion, `for...of`, total helpers, and explicit boundary failures over imperative mutation-heavy control flow.
- At async interop boundaries, prefer `Effect.promise`, `Effect.async`, or `Effect.callback`. Use `Effect.tryPromise` only when you intentionally need to translate a thrown or rejected cause into a typed domain error.
- Prefer tagged unions, schema decoders, `Option`/`Either`, and Effect error channels over sentinel strings and defensive object spelunking.
- Lint policy has two profiles in `packages/tooling/oxlint.profiles.ts`: `backend` adds the Effect house-style plugin, while `ui` focuses on boundary safety and unsafe TypeScript escape hatches. Both run every Effect language-service rule through `effect-tsrs oxlint`. Change the profile instead of adding per-workspace Oxlint configs.
- Big, deep modules are welcome. Do not split files or functions just to satisfy a tool; no linter enforces file or function length, and Fallow's "split" refactoring targets are advisory.
- Fallow owns architecture: zones and allowed imports live in `.fallowrc.jsonc`, runtime import and side-effect bans live in `.fallow/rules/`. Put every new file in a zone, and use these instead of `no-restricted-imports`.
- Every lint suppression names its rule and gives a reason after `--`.

Dependency patches live in `patches/`. After upgrading any patched package, run `bun run patches:check` and delete patches it reports as unused or no longer needed.

For PR descriptions and review materials, use the project skill at `.agents/skills/pr-visual-review/SKILL.md`: prefer Pele diagram images in tables, concise FAQs, and an honest validation table over long prose.

For creating or revising GitHub issues and proposing issue cleanup, use `.agents/skills/issue-visual-writing/SKILL.md`: prefer Pele diagrams uploaded with `gh issue create --attach`, image tables, concise FAQs, and verifiable acceptance criteria. Keep generated images uncommitted unless an SVG is intentionally included in a README.
