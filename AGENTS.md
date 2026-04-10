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
- Prefer tagged unions, schema decoders, `Option`/`Either`, and Effect error channels over sentinel strings and defensive object spelunking.
- Keep lint policy workspace-local: backend rules can be stricter and Effect-specific, while UI rules should focus on boundary safety and unsafe TypeScript escape hatches.

@FP_AGENTS.md
